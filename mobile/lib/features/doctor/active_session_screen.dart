import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_state.dart';
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
/// When [slotId] is provided the screen POSTs `/attendance/session/start`
/// on entry and refreshes the rotating QR every `intervalSeconds` via
/// `GET /attendance/session/:id/qr`. The "End lecture" button POSTs
/// `/attendance/session/:id/end` then pops back to the doctor home.
///
/// The `_present` / `_absent` lists are still demo placeholders — wiring
/// them to the live socket stream from `attendance.gateway` is the next
/// follow-on commit.
class ActiveSessionScreen extends ConsumerStatefulWidget {
  const ActiveSessionScreen({
    super.key,
    required this.subject,
    required this.section,
    required this.room,
    this.slotId,
  });

  final String subject;
  final String section;
  final String room;

  /// When non-null we POST `/attendance/session/start` against this slot
  /// on first frame and drive the live QR off the returned `sessionId`.
  /// When null we fall back to the legacy demo ticker so the screen still
  /// renders something useful when opened standalone (e.g. design QA).
  final String? slotId;

  @override
  ConsumerState<ActiveSessionScreen> createState() => _ActiveSessionScreenState();
}

class _ActiveSessionScreenState extends ConsumerState<ActiveSessionScreen>
    with SingleTickerProviderStateMixin {
  Timer? _ticker;
  int _seconds = 30;
  int _rotationSeconds = 30;
  String _qrPayload = 'demo:0';
  String? _sessionId;
  final int _expectedTotal = 45;
  bool _ending = false;
  final List<_Entry> _present = [];
  final List<_Entry> _absent = [];
  late final TabController _tab =
      TabController(length: 2, vsync: this, initialIndex: 0);
  final _rng = math.Random(7);

  @override
  void initState() {
    super.initState();
    // Two execution modes:
    //  - real:  slotId is given -> POST /attendance/session/start and
    //           drive the QR off the returned payload, refreshing every
    //           rotationSeconds via GET /session/:id/qr.
    //  - demo:  no slotId       -> keep the legacy random ticker so the
    //           screen still renders for design QA / docs.
    if (widget.slotId != null) {
      _startSession();
    } else {
      _startDemoTicker();
    }
  }

  Future<void> _startSession() async {
    final api = ref.read(apiProvider);
    try {
      final r = await api.dio.post(
        '/attendance/session/start',
        data: {'scheduleSlotId': widget.slotId},
      );
      final data = (r.data['data'] ?? const {}) as Map<String, dynamic>;
      final sid = data['id'] as String? ?? data['sessionId'] as String?;
      final payload = data['qrPayload'] as String? ??
          data['payload'] as String? ??
          _qrPayload;
      final interval = (data['intervalSeconds'] as num?)?.toInt() ?? 30;
      if (!mounted) return;
      setState(() {
        _sessionId = sid;
        _qrPayload = payload;
        _rotationSeconds = interval;
        _seconds = interval;
      });
      _startRealTicker();
    } catch (e) {
      debugPrint('[doctor] start session failed: $e');
      if (!mounted) return;
      _startDemoTicker();
    }
  }

  void _startDemoTicker() {
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() {
        if (_seconds > 1) {
          _seconds -= 1;
        } else {
          _seconds = _rotationSeconds;
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

  void _startRealTicker() {
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) async {
      if (!mounted) return;
      setState(() {
        if (_seconds > 1) {
          _seconds -= 1;
        } else {
          _seconds = _rotationSeconds;
        }
      });
      // When the window flips, fetch the next rotating token.
      if (_seconds == _rotationSeconds && _sessionId != null) {
        try {
          final r = await ref
              .read(apiProvider)
              .dio
              .get('/attendance/session/$_sessionId/qr');
          final data = (r.data['data'] ?? const {}) as Map<String, dynamic>;
          final payload = data['payload'] as String? ??
              data['qrPayload'] as String? ??
              _qrPayload;
          if (!mounted) return;
          setState(() => _qrPayload = payload);
        } catch (e) {
          debugPrint('[doctor] qr refresh failed: $e');
        }
      }
    });
  }

  Future<void> _endLecture() async {
    if (_ending) return;
    setState(() => _ending = true);
    try {
      if (_sessionId != null) {
        await ref
            .read(apiProvider)
            .dio
            .post('/attendance/session/$_sessionId/end');
      }
    } catch (e) {
      debugPrint('[doctor] end session failed: $e');
    }
    if (!mounted) return;
    setState(() => _ending = false);
    // Whether or not the POST succeeded, pop back to the doctor home so
    // the doctor isn't trapped on the active screen. Prefer the
    // Material Navigator (always present, also works in widget tests),
    // then fall back to GoRouter for the production app.
    final nav = Navigator.maybeOf(context);
    if (nav != null && nav.canPop()) {
      nav.pop();
      return;
    }
    try {
      context.go('/doctor/today');
    } catch (_) {
      // No GoRouter in scope (e.g. widget tests) — already-pumped state
      // is the most we can do.
    }
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
                rotationSeconds: _rotationSeconds,
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
                  onPressed: _ending ? null : _endLecture,
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
