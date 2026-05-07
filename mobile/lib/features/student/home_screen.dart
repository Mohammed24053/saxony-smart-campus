import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/bento_tile.dart';
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

  String _greetingKey() {
    final h = DateTime.now().hour;
    if (h < 12) return 'home.goodMorning';
    if (h < 17) return 'home.goodAfternoon';
    return 'home.goodEvening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider);
    final lectures = ref.watch(_todayProvider);
    final theme = Theme.of(context);
    final s = AppStrings.of(context);
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
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  children: [
                    // Greeting tile (full-width bento) — anchors the hierarchy
                    // and gives the page a soft, marketing-y entrance.
                    BentoTile(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${s.t(_greetingKey())},',
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: SeuColors.gray,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  user?.name ?? s.t('home.studentFallback'),
                                  style: theme.textTheme.headlineMedium,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  DateFormat('EEEE, MMMM d').format(DateTime.now()),
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: SeuColors.gray,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [SeuColors.red, Color(0xFF8B1B22)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            alignment: Alignment.center,
                            child: const Text(
                              'SE',
                              style: TextStyle(
                                color: SeuColors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Hero countdown tile — the visual anchor of the home
                    // screen, lifted shadow + navy gradient.
                    lectures.when(
                      data: (data) => _NextLectureCountdown(lectures: data),
                      loading: () => const _NextLectureSkeleton(),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                    const SizedBox(height: 12),

                    // Quick-stats bento row (2x1 each, 1x2 layout).
                    lectures.when(
                      data: (data) => _QuickStatsRow(lectures: data),
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                    const SizedBox(height: 16),

                    Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 8),
                      child: Row(
                        children: [
                          Text(
                            s.t('home.todayLectures'),
                            style: theme.textTheme.titleLarge,
                          ),
                          const SizedBox(width: 8),
                          BentoLabel(text: s.t('common.todayLabel')),
                        ],
                      ),
                    ),
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

  String _format(BuildContext context, Duration d) {
    if (d.isNegative) return AppStrings.of(context).t('home.inProgress');
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
    final s = AppStrings.of(context);
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
                s.t('home.allCaughtUp'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ),
      );
    }
    // Hero bento tile: navy gradient with a gold accent strip and a soft lift.
    return BentoTile(
      lift: true,
      gradient: const LinearGradient(
        colors: [SeuColors.navy, Color(0xFF1F1F26)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(SeuRadius.xl),
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: SeuColors.gold,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                s.t('home.nextLectureLabel'),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SeuColors.gold,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.w700,
                      fontSize: 10,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _format(context, _remaining),
            style: const TextStyle(
              color: SeuColors.white,
              fontSize: 44,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              height: 1.0,
            ),
          ).animate().fadeIn(duration: const Duration(milliseconds: 250)),
          const SizedBox(height: 10),
          Text(
            _next!.subject,
            style: const TextStyle(
              color: SeuColors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              const Icon(Icons.place_outlined, size: 13, color: SeuColors.cream),
              const SizedBox(width: 4),
              Text(
                '${_next!.room} · ${_next!.doctor}',
                style: const TextStyle(color: SeuColors.cream, fontSize: 12.5),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Quick-stats row — two side-by-side bento tiles surfacing summary numbers.
///
/// On the bento aesthetic we surface counts as oversized numerals (Apple-y)
/// rather than tiny progress indicators. Each tile is tappable for future
/// drill-downs.
class _QuickStatsRow extends StatelessWidget {
  const _QuickStatsRow({required this.lectures});
  final List<_Lecture> lectures;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final upcoming = lectures.where((l) => l.start.isAfter(now)).length;
    final inProgress = lectures.where(
      (l) => l.start.isBefore(now) && l.end.isAfter(now),
    ).length;

    final s = AppStrings.of(context);
    return Row(
      children: [
        Expanded(
          child: _StatTile(
            label: s.t('home.upcoming'),
            value: upcoming.toString(),
            accent: SeuColors.red,
            icon: Icons.schedule,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatTile(
            label: s.t('home.inProgress'),
            value: inProgress.toString(),
            accent: SeuColors.success,
            icon: Icons.bolt_outlined,
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.accent,
    required this.icon,
  });
  final String label;
  final String value;
  final Color accent;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return BentoTile(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 16, color: accent),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              color: SeuColors.navy,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SeuColors.gray,
                  fontWeight: FontWeight.w500,
                ),
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
        child: Text(AppStrings.of(context).t('home.noToday')),
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
        AppStrings.of(context).fill('common.failedToLoad', {'message': message}),
        style: const TextStyle(color: SeuColors.danger),
      ),
    );
  }
}
