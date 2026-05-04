import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/attendance_ring.dart';
import '../../widgets/seu/status_chip.dart';

class _SubjectSummary {
  _SubjectSummary({
    required this.subject,
    required this.percent,
    required this.entries,
  });
  final String subject;
  final double percent;
  final List<_HistoryEntry> entries;
}

class _HistoryEntry {
  _HistoryEntry({required this.when, required this.tone});
  final DateTime when;
  final AttendanceTone tone;
}

final historyProvider = FutureProvider<List<_SubjectSummary>>((ref) async {
  final user = ref.read(authProvider);
  if (user == null) return const [];
  final api = ref.read(apiProvider);
  final r = await api.dio.get('/attendance/student/${user.id}');
  final items = r.data['data']['items'] as List<dynamic>;
  final bySubject = <String, List<_HistoryEntry>>{};
  for (final raw in items) {
    final m = raw as Map<String, dynamic>;
    final subject =
        m['session']?['scheduleSlot']?['subject']?['name'] as String? ?? '—';
    final when = DateTime.tryParse(
            (m['scannedAt'] ?? m['createdAt'])?.toString() ?? '') ??
        DateTime.now();
    final status = (m['status'] as String? ?? '').toLowerCase();
    final tone = switch (status) {
      'present' => AttendanceTone.present,
      'late' => AttendanceTone.late,
      _ => AttendanceTone.absent,
    };
    bySubject
        .putIfAbsent(subject, () => [])
        .add(_HistoryEntry(when: when, tone: tone));
  }
  return bySubject.entries.map((e) {
    final total = e.value.length;
    final present = e.value
        .where((x) => x.tone != AttendanceTone.absent)
        .length;
    return _SubjectSummary(
      subject: e.key,
      percent: total == 0 ? 0 : present / total,
      entries: e.value..sort((a, b) => b.when.compareTo(a.when)),
    );
  }).toList();
});

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(historyProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance history')),
      body: async.when(
        data: (subjects) {
          if (subjects.isEmpty) {
            return Center(
              child: Text(
                'No attendance records yet.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: SeuColors.gray,
                    ),
              ),
            );
          }
          return RefreshIndicator(
            color: SeuColors.red,
            onRefresh: () async => ref.invalidate(historyProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              itemCount: subjects.length,
              itemBuilder: (_, i) =>
                  _SubjectCard(summary: subjects[i]).animate().fadeIn(
                        delay: Duration(milliseconds: i * 40),
                        duration: const Duration(milliseconds: 280),
                      ),
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(color: SeuColors.red),
        ),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class _SubjectCard extends StatefulWidget {
  const _SubjectCard({required this.summary});
  final _SubjectSummary summary;

  @override
  State<_SubjectCard> createState() => _SubjectCardState();
}

class _SubjectCardState extends State<_SubjectCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat.yMMMd().add_Hm();
    final atRisk = widget.summary.percent < 0.75;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: SeuRadius.lgR,
        boxShadow: SeuShadow.tile,
      ),
      child: Column(
        children: [
          Row(
            children: [
              AttendanceRing(percent: widget.summary.percent, size: 72),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.summary.subject,
                      style: Theme.of(context).textTheme.titleLarge,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${widget.summary.entries.length} lectures',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (atRisk) ...[
                      const SizedBox(height: 6),
                      const StatusChip(
                        tone: AttendanceTone.warning1,
                        label: 'Approaching threshold',
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                icon: AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 220),
                  child: const Icon(Icons.expand_more),
                ),
              ),
            ],
          ),
          AnimatedCrossFade(
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 220),
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Column(
                children: [
                  for (final entry in widget.summary.entries)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              fmt.format(entry.when),
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                          StatusChip(tone: entry.tone),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
