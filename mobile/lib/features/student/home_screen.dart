import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/lecture_card.dart';
import '../../widgets/seu/offline_banner.dart';

class _Lecture {
  _Lecture({
    required this.subject,
    required this.start,
    required this.end,
    required this.room,
    required this.doctor,
    required this.accent,
  });

  final String subject;
  final DateTime start;
  final DateTime end;
  final String room;
  final String doctor;
  final Color accent;
}

final _todayProvider = FutureProvider<List<_Lecture>>((ref) async {
  // Best-effort fetch of today's slots; falls back to empty list rather than
  // exploding if the endpoint isn't yet implemented for the student role.
  final api = ref.read(apiProvider);
  try {
    final r = await api.dio.get('/schedule/my');
    final slots = r.data['data']['slots'] as List<dynamic>;
    final now = DateTime.now();
    final today = now.weekday % 7; // Sun=0..Sat=6 in our convention
    final accents = const [
      SeuColors.red,
      SeuColors.gold,
      SeuColors.info,
      SeuColors.success,
    ];
    return slots
        .where((s) => (s as Map<String, dynamic>)['dayOfWeek'] == today)
        .toList()
        .asMap()
        .entries
        .map((e) {
      final s = e.value as Map<String, dynamic>;
      final startStr = (s['startTime'] as String?) ?? '08:00';
      final endStr = (s['endTime'] as String?) ?? '09:00';
      DateTime parse(String t) {
        final parts = t.split(':');
        return DateTime(now.year, now.month, now.day,
            int.parse(parts[0]), int.parse(parts[1]));
      }

      return _Lecture(
        subject: s['subject']?['name'] as String? ?? '—',
        start: parse(startStr),
        end: parse(endStr),
        room: s['room']?['name'] as String? ?? '',
        doctor: s['doctor']?['name'] as String? ?? '',
        accent: accents[e.key % accents.length],
      );
    }).toList();
  } catch (_) {
    return const [];
  }
});

class StudentHomeScreen extends ConsumerWidget {
  const StudentHomeScreen({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider);
    final lectures = ref.watch(_todayProvider);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: RefreshIndicator(
                color: SeuColors.red,
                onRefresh: () async => ref.invalidate(_todayProvider),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  children: [
                    Text(
                      '${_greeting()},',
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: SeuColors.gray,
                      ),
                    ),
                    Text(
                      user?.name ?? 'Student',
                      style: theme.textTheme.headlineLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('EEEE, MMMM d').format(DateTime.now()),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: SeuColors.gray,
                      ),
                    ),
                    const SizedBox(height: 16),
                    lectures.when(
                      data: (data) => _NextLectureCountdown(lectures: data),
                      loading: () => const _NextLectureSkeleton(),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      "Today's lectures",
                      style: theme.textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    lectures.when(
                      data: (data) => _LectureList(items: data),
                      loading: () => const _LectureListSkeleton(),
                      error: (e, _) => _ErrorCard(message: '$e'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NextLectureCountdown extends StatefulWidget {
  const _NextLectureCountdown({required this.lectures});
  final List<_Lecture> lectures;

  @override
  State<_NextLectureCountdown> createState() => _NextLectureCountdownState();
}

class _NextLectureCountdownState extends State<_NextLectureCountdown> {
  Timer? _ticker;
  Duration _remaining = Duration.zero;
  _Lecture? _next;

  void _recompute() {
    final now = DateTime.now();
    _Lecture? next;
    for (final l in widget.lectures) {
      if (l.start.isAfter(now) || (l.start.isBefore(now) && l.end.isAfter(now))) {
        next = l;
        break;
      }
    }
    setState(() {
      _next = next;
      _remaining = next == null ? Duration.zero : next.start.difference(now);
    });
  }

  @override
  void initState() {
    super.initState();
    _recompute();
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) => _recompute());
  }

  @override
  void didUpdateWidget(covariant _NextLectureCountdown old) {
    super.didUpdateWidget(old);
    _recompute();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _format(Duration d) {
    if (d.isNegative) return 'In progress';
    if (d.inHours > 0) {
      return '${d.inHours}h ${d.inMinutes % 60}m';
    }
    if (d.inMinutes > 0) {
      return '${d.inMinutes}m ${d.inSeconds % 60}s';
    }
    return '${d.inSeconds}s';
  }

  @override
  Widget build(BuildContext context) {
    if (_next == null) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: SeuColors.white,
          borderRadius: SeuRadius.lgR,
          border: Border.all(color: SeuColors.navy.withOpacity(0.06)),
        ),
        child: Row(
          children: [
            const Icon(Icons.celebration, color: SeuColors.gold, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'No more lectures today',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [SeuColors.navy, SeuColors.navy.withOpacity(0.92)],
        ),
        borderRadius: SeuRadius.lgR,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Next lecture in',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: SeuColors.gold,
                  letterSpacing: 0.5,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            _format(_remaining),
            style: const TextStyle(
              color: SeuColors.white,
              fontSize: 38,
              fontWeight: FontWeight.w800,
            ),
          ).animate().fadeIn(duration: const Duration(milliseconds: 250)),
          const SizedBox(height: 6),
          Text(
            '${_next!.subject} · ${_next!.room}',
            style: const TextStyle(color: SeuColors.cream, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _LectureList extends StatelessWidget {
  const _LectureList({required this.items});
  final List<_Lecture> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: SeuColors.white,
          borderRadius: SeuRadius.lgR,
          border: Border.all(color: SeuColors.navy.withOpacity(0.06)),
        ),
        child: const Text('No lectures scheduled for today.'),
      );
    }
    final now = DateTime.now();
    final fmt = DateFormat.Hm();
    return Column(
      children: [
        for (var i = 0; i < items.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LectureCard(
              subject: items[i].subject,
              time: '${fmt.format(items[i].start)}–${fmt.format(items[i].end)}',
              room: items[i].room,
              doctor: items[i].doctor,
              accent: items[i].accent,
              isCurrent: items[i].start.isBefore(now) &&
                  items[i].end.isAfter(now),
            )
                .animate()
                .fadeIn(
                  delay: Duration(milliseconds: i * 30),
                  duration: const Duration(milliseconds: 260),
                )
                .slideX(
                  begin: 0.08,
                  end: 0,
                  delay: Duration(milliseconds: i * 30),
                  duration: const Duration(milliseconds: 260),
                  curve: SeuMotion.enter,
                ),
          ),
      ],
    );
  }
}

class _NextLectureSkeleton extends StatelessWidget {
  const _NextLectureSkeleton();
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 132,
      decoration: BoxDecoration(
        color: SeuColors.navy.withOpacity(0.06),
        borderRadius: SeuRadius.lgR,
      ),
    ).animate(onPlay: (c) => c.repeat()).shimmer(
          duration: const Duration(milliseconds: 1500),
          color: SeuColors.cream.withOpacity(0.3),
        );
  }
}

class _LectureListSkeleton extends StatelessWidget {
  const _LectureListSkeleton();
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Container(
              height: 88,
              decoration: BoxDecoration(
                color: SeuColors.navy.withOpacity(0.06),
                borderRadius: SeuRadius.lgR,
              ),
            ).animate(onPlay: (c) => c.repeat()).shimmer(
                  duration: const Duration(milliseconds: 1500),
                  color: SeuColors.cream.withOpacity(0.3),
                ),
          ),
      ],
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SeuColors.danger.withOpacity(0.06),
        borderRadius: SeuRadius.lgR,
        border: Border.all(color: SeuColors.danger.withOpacity(0.4)),
      ),
      child: Text(
        'Failed to load: $message',
        style: const TextStyle(color: SeuColors.danger),
      ),
    );
  }
}
