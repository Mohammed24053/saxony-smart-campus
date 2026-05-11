import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';

/// Doctor's "today" landing screen — lists today's lectures (from
/// `/me/schedule/today`) and lets each one open the active-session screen
/// via the "Start lecture" CTA. Pre-session list mirrors the design brief.
class DoctorHomeScreen extends ConsumerStatefulWidget {
  const DoctorHomeScreen({super.key});

  @override
  ConsumerState<DoctorHomeScreen> createState() => _DoctorHomeScreenState();
}

class _DoctorHomeScreenState extends ConsumerState<DoctorHomeScreen> {
  late Future<List<_TodaySlot>> _futureSlots;

  @override
  void initState() {
    super.initState();
    _futureSlots = _fetch();
  }

  Future<List<_TodaySlot>> _fetch() async {
    final api = ref.read(apiProvider);
    try {
      final r = await api.dio.get('/me/schedule/today');
      final raw = r.data['data'] as List<dynamic>? ?? const [];
      return raw
          .map((e) => _TodaySlot.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final user = ref.watch(authProvider);
    return Scaffold(
      backgroundColor: SeuColors.cream,
      appBar: AppBar(
        title: Text(s.t('doctor.todayTitle')),
        backgroundColor: SeuColors.navy,
        foregroundColor: SeuColors.white,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: s.t('auth.signOut'),
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: SafeArea(
        child: FutureBuilder<List<_TodaySlot>>(
          future: _futureSlots,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final slots = snap.data ?? const [];
            return RefreshIndicator(
              onRefresh: () async {
                setState(() => _futureSlots = _fetch());
                await _futureSlots;
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (user != null) ...[
                    Text(
                      '${s.t('home.greeting')} ${user.name.split(' ').first}',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _today(),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: SeuColors.gray,
                          ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (slots.isEmpty)
                    _EmptyTile(label: s.t('home.todayEmpty'))
                  else
                    ...slots.indexed.map(
                      (e) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _LectureRow(slot: e.$2)
                            .animate()
                            .fadeIn(delay: (60 * e.$1).ms)
                            .slideY(begin: .15, end: 0),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  String _today() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}

class _TodaySlot {
  final String slotId;
  final String subject;
  final String section;
  final String room;
  final String time;
  _TodaySlot({
    required this.slotId,
    required this.subject,
    required this.section,
    required this.room,
    required this.time,
  });

  factory _TodaySlot.fromJson(Map<String, dynamic> j) => _TodaySlot(
        slotId: (j['id'] ?? '') as String,
        subject: ((j['subject'] ?? const {}) as Map)['name'] as String? ??
            j['subjectName'] as String? ??
            'Lecture',
        section: ((j['section'] ?? const {}) as Map)['name'] as String? ??
            j['sectionName'] as String? ??
            'Section',
        room: ((j['room'] ?? const {}) as Map)['name'] as String? ??
            j['roomName'] as String? ??
            'Room',
        time: '${j['startTime'] ?? ''} – ${j['endTime'] ?? ''}',
      );
}

class _LectureRow extends StatelessWidget {
  const _LectureRow({required this.slot});
  final _TodaySlot slot;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: BorderRadius.circular(SeuRadius.lg),
        boxShadow: SeuShadow.tile,
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 56,
            decoration: BoxDecoration(
              color: SeuColors.red,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  slot.subject,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 2),
                Text(
                  '${slot.section} • ${slot.room}',
                  style: TextStyle(color: SeuColors.gray, fontSize: 12),
                ),
                const SizedBox(height: 2),
                Text(
                  slot.time,
                  style: TextStyle(
                    color: SeuColors.navy,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: SeuColors.red,
              foregroundColor: SeuColors.white,
            ),
            onPressed: () => context.go('/doctor/active', extra: {
              'subject': slot.subject,
              'section': slot.section,
              'room': slot.room,
              'slotId': slot.slotId,
            }),
            icon: const Icon(Icons.play_arrow_rounded, size: 18),
            label: Text(s.t('doctor.startLecture')),
          ),
        ],
      ),
    );
  }
}

class _EmptyTile extends StatelessWidget {
  const _EmptyTile({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: BorderRadius.circular(SeuRadius.lg),
        boxShadow: SeuShadow.tile,
      ),
      child: Center(
        child: Text(
          label,
          style: TextStyle(color: SeuColors.gray, fontSize: 13),
        ),
      ),
    );
  }
}
