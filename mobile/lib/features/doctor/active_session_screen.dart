import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/strings.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/live_counter.dart';
import '../../widgets/seu/qr_display.dart';
import '../../widgets/seu/status_chip.dart';

/// Doctor's active-lecture screen.
///
/// Shows: subject + section + room header, large rotating QR with countdown
/// ring, live counter (flip animation), tab bar (Present | Absent), real-time
/// student feed sliding in from the right with green flash, and an "End
/// lecture" CTA at the bottom.
///
/// This is presentation-only — wires would be a small refactor: hook
/// `_qrPayload` into the live socket stream from `attendance.gateway` and
/// `_present`/`_absent` into the session feed.
class ActiveSessionScreen extends ConsumerStatefulWidget {
  const ActiveSessionScreen({
    super.key,
    required this.subject,
    required this.section,
    required this.room,
  });

  final String subject;
  final String section;
  final String room;

  @override
  ConsumerState<ActiveSessionScreen> createState() => _ActiveSessionScreenState();
}

class _ActiveSessionScreenState extends ConsumerState<ActiveSessionScreen>
    with SingleTickerProviderStateMixin {
  Timer? _ticker;
  int _seconds = 30;
  String _qrPayload = 'demo:0';
  int _expectedTotal = 45;
  final List<_Entry> _present = [];
  final List<_Entry> _absent = [];
  late final TabController _tab =
      TabController(length: 2, vsync: this, initialIndex: 0);
  final _rng = math.Random(7);

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() {
        if (_seconds > 1) {
          _seconds -= 1;
        } else {
          _seconds = 30;
          _qrPayload = 'demo:${DateTime.now().millisecondsSinceEpoch}';
        }
        // Demo: occasionally a student arrives.
        if (_rng.nextDouble() < 0.18 && _present.length < _expectedTotal) {
          _present.insert(
            0,
            _Entry(
              id: 'STU-${1000 + _present.length}',
              name: _names[_present.length % _names.length],
              tone: _rng.nextDouble() < 0.85
                  ? AttendanceTone.present
                  : AttendanceTone.late,
            ),
          );
        }
      });
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Scaffold(
      backgroundColor: SeuColors.cream,
      appBar: AppBar(
        title: Text(widget.subject),
        actions: [
          IconButton(
            tooltip: s.t('doctor.pause'),
            icon: const Icon(Icons.pause_circle_outline),
            onPressed: () {},
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: SeuColors.white,
                  borderRadius: SeuRadius.lgR,
                  border: Border.all(color: SeuColors.navy.withOpacity(0.06)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.section,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          Text(
                            widget.room,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: SeuColors.success,
                        borderRadius: SeuRadius.xlR,
                      ),
                      child: Text(
                        s.t('common.live'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: QrDisplayWidget(
                payload: _qrPayload,
                secondsRemaining: _seconds,
                rotationSeconds: 30,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                LiveCounter(value: _present.length, minDigits: 2),
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    '/ $_expectedTotal',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: SeuColors.gray,
                        ),
                  ),
                ),
              ],
            ),
            Text(
              s.t('doctor.currentlyPresent'),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: SeuColors.gray,
                    letterSpacing: 0.4,
                  ),
            ),
            const SizedBox(height: 12),
            TabBar(
              controller: _tab,
              labelColor: SeuColors.red,
              unselectedLabelColor: SeuColors.gray,
              indicatorColor: SeuColors.red,
              tabs: [
                Tab(text: s.count('doctor.tabPresent', _present.length)),
                Tab(text: s.count('doctor.tabAbsent', _absent.length)),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tab,
                children: [
                  _EntryList(
                      items: _present, emptyLabel: s.t('doctor.noScansYet')),
                  _EntryList(items: _absent, emptyLabel: s.t('doctor.empty')),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.stop_circle_outlined),
                  onPressed: () => Navigator.of(context).maybePop(),
                  label: Text(s.t('doctor.endLecture')),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Entry {
  _Entry({required this.id, required this.name, required this.tone});
  final String id;
  final String name;
  final AttendanceTone tone;
}

class _EntryList extends StatelessWidget {
  const _EntryList({required this.items, required this.emptyLabel});
  final List<_Entry> items;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
        child: Text(emptyLabel,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: SeuColors.gray,
                )),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 6),
      itemBuilder: (_, i) {
        final e = items[i];
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: SeuColors.white,
            borderRadius: SeuRadius.mdR,
            border: Border.all(color: SeuColors.navy.withOpacity(0.06)),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: SeuColors.navy,
                radius: 16,
                child: Text(
                  e.name.split(' ').take(2).map((p) => p[0]).join(),
                  style: const TextStyle(
                    color: SeuColors.gold,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(e.name,
                        style: Theme.of(context).textTheme.bodyLarge),
                    Text(e.id,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures()
                              ],
                            )),
                  ],
                ),
              ),
              StatusChip(tone: e.tone),
            ],
          ),
        )
            .animate()
            .slideX(
              begin: 0.15,
              end: 0,
              duration: const Duration(milliseconds: 280),
              curve: SeuMotion.enter,
            )
            .fadeIn(duration: const Duration(milliseconds: 280));
      },
    );
  }
}

const _names = [
  'Aya Ibrahim',
  'Mahmoud Hassan',
  'Yasmin Ali',
  'Omar Khaled',
  'Layla Saad',
  'Karim Adel',
  'Salma Fawzy',
  'Hossam Ramadan',
  'Mariam Tarek',
  'Ahmed Said',
];
