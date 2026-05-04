import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/lecture_card.dart';
import '../../widgets/seu/offline_banner.dart';

final scheduleProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiProvider);
  final r = await api.dio.get('/schedule/my');
  return r.data['data']['slots'] as List<dynamic>;
});

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});

  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  int _selectedDay = DateTime.now().weekday % 7;

  Color _accentFor(int idx) {
    const palette = [
      SeuColors.red,
      SeuColors.gold,
      SeuColors.info,
      SeuColors.success,
    ];
    return palette[idx % palette.length];
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(scheduleProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Schedule')),
      body: Column(
        children: [
          const OfflineBanner(),
          // Bento-style day picker — segmented pill row floating above the
          // cream background. Selected chip uses the SEU red gradient.
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var i = 0; i < _days.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedDay = i),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          curve: SeuMotion.spring,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            gradient: _selectedDay == i
                                ? const LinearGradient(
                                    colors: [
                                      SeuColors.red,
                                      Color(0xFF8B1B22),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  )
                                : null,
                            color: _selectedDay == i ? null : SeuColors.white,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: SeuShadow.tile,
                          ),
                          child: Text(
                            _days[i],
                            style: TextStyle(
                              color: _selectedDay == i
                                  ? SeuColors.white
                                  : SeuColors.navy,
                              fontWeight: FontWeight.w700,
                              fontSize: 12.5,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: async.when(
              data: (slots) {
                final filtered = slots
                    .where((s) =>
                        (s as Map<String, dynamic>)['dayOfWeek'] == _selectedDay)
                    .toList();
                if (filtered.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Text(
                        'No lectures on ${_days[_selectedDay]}.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: SeuColors.gray,
                            ),
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  color: SeuColors.red,
                  onRefresh: () async => ref.invalidate(scheduleProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final s = filtered[i] as Map<String, dynamic>;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: LectureCard(
                          subject: s['subject']?['name'] as String? ?? '—',
                          time:
                              '${s['startTime'] ?? ''}–${s['endTime'] ?? ''}',
                          room: s['room']?['name'] as String? ?? '',
                          doctor: s['doctor']?['name'] as String? ?? '',
                          accent: _accentFor(i),
                        )
                            .animate()
                            .fadeIn(
                              delay: Duration(milliseconds: i * 30),
                              duration: const Duration(milliseconds: 240),
                            )
                            .slideX(
                              begin: 0.08,
                              end: 0,
                              delay: Duration(milliseconds: i * 30),
                              duration: const Duration(milliseconds: 240),
                              curve: SeuMotion.enter,
                            ),
                      );
                    },
                  ),
                );
              },
              loading: () =>
                  const Center(child: CircularProgressIndicator(color: SeuColors.red)),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ),
        ],
      ),
    );
  }
}
