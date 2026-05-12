import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/strings.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/bento_tile.dart';
import '../../widgets/seu/live_counter.dart';
import '../../widgets/seu/qr_display.dart';
import '../../widgets/seu/status_chip.dart';

/// Doctor's active-lecture screen (round 2 bento redesign).
///
/// Navy gradient header carrying subject + section/room + a pulsing LIVE
/// chip, a bento QR hero (rotating payload + countdown ring + scan prompt),
/// a paired present/absent stat row driven by [LiveCounter], pill-style
/// segmented tabs, and an animated entry list. A sticky bottom action ends
/// the session.
///
/// Presentation-only: hook `_qrPayload` into the live socket stream from
/// `attendance.gateway` and `_present`/`_absent` into the session feed to
/// wire the real data.
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
  ConsumerState<ActiveSessionScreen> createState() =>
      _ActiveSessionScreenState();
}

class _ActiveSessionScreenState extends ConsumerState<ActiveSessionScreen>
    with SingleTickerProviderStateMixin {
  Timer? _ticker;
  int _seconds = 30;
  String _qrPayload = 'demo:0';
  final int _expectedTotal = 45;
  final List<_Entry> _present = [];
  final List<_Entry> _absent = [];
  late final TabController _tab =
      TabController(length: 2, vsync: this, initialIndex: 0);
  final _rng = math.Random(7);

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
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

  void _endLecture() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go('/doctor/today');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Scaffold(
      backgroundColor: SeuColors.cream,
      body: Column(
        children: [
          _SessionHeader(
            subject: widget.subject,
            section: widget.section,
            room: widget.room,
            onBack: _endLecture,
          ),
          Expanded(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: _QrHero(
                    payload: _qrPayload,
                    seconds: _seconds,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: _StatsRow(
                    present: _present.length,
                    absent: _absent.length,
                    expected: _expectedTotal,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                  child: _SegmentedTabs(
                    controller: _tab,
                    tabs: [
                      s.count('doctor.tabPresent', _present.length),
                      s.count('doctor.tabAbsent', _absent.length),
                    ],
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tab,
                    children: [
                      _EntryList(
                          items: _present,
                          emptyLabel: s.t('doctor.noScansYet')),
                      _EntryList(
                          items: _absent, emptyLabel: s.t('doctor.empty')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _SessionBottomBar(onEnd: _endLecture),
        ],
      ),
    );
  }
}

/// Custom navy gradient header (replaces the AppBar). Wraps the subject /
/// section / room metadata and a live pulse chip.
class _SessionHeader extends StatelessWidget {
  const _SessionHeader({
    required this.subject,
    required this.section,
    required this.room,
    required this.onBack,
  });

  final String subject;
  final String section;
  final String room;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [SeuColors.navy, Color(0xFF1F1F26)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(SeuRadius.xl),
        ),
        boxShadow: SeuShadow.tileLift,
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(8, 8, 16, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: s.t('doctor.backToToday'),
                    onPressed: onBack,
                    icon: Icon(
                      isRtl
                          ? Icons.arrow_forward_rounded
                          : Icons.arrow_back_rounded,
                      color: SeuColors.white,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      subject,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: SeuColors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  const _LivePulseChip(),
                ],
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 12),
                child: Row(
                  children: [
                    const Icon(Icons.groups_outlined,
                        size: 14, color: SeuColors.cream),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        section,
                        style: const TextStyle(
                          color: SeuColors.cream,
                          fontSize: 12.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Icon(Icons.place_outlined,
                        size: 14, color: SeuColors.cream),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        room,
                        style: const TextStyle(
                          color: SeuColors.cream,
                          fontSize: 12.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LivePulseChip extends StatefulWidget {
  const _LivePulseChip();
  @override
  State<_LivePulseChip> createState() => _LivePulseChipState();
}

class _LivePulseChipState extends State<_LivePulseChip>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl =
      AnimationController(vsync: this, duration: const Duration(seconds: 1))
        ..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: SeuColors.success.withOpacity(0.18 + 0.10 * _ctrl.value),
          borderRadius: SeuRadius.xlR,
          border: Border.all(
            color: SeuColors.success.withOpacity(0.6),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: SeuColors.success
                    .withOpacity(0.6 + 0.4 * _ctrl.value),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              s.t('common.live'),
              style: const TextStyle(
                color: SeuColors.white,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QrHero extends StatelessWidget {
  const _QrHero({required this.payload, required this.seconds});
  final String payload;
  final int seconds;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return BentoTile(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
      child: Column(
        children: [
          QrDisplayWidget(
            payload: payload,
            secondsRemaining: seconds,
            rotationSeconds: 30,
            size: 200,
          ),
          const SizedBox(height: 6),
          Text(
            s.t('doctor.scanPrompt'),
            textAlign: TextAlign.center,
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

class _StatsRow extends StatelessWidget {
  const _StatsRow({
    required this.present,
    required this.absent,
    required this.expected,
  });
  final int present;
  final int absent;
  final int expected;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: _StatTile(
            label: s.t('doctor.currentlyPresent'),
            value: present,
            total: expected,
            accent: SeuColors.success,
            icon: Icons.check_circle_outline,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatTile(
            label: s.t('attendance.absent'),
            value: math.max(0, expected - present - absent),
            total: expected,
            accent: SeuColors.danger,
            icon: Icons.timelapse_outlined,
            useLiveCounter: false,
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
    required this.total,
    required this.accent,
    required this.icon,
    this.useLiveCounter = true,
  });
  final String label;
  final int value;
  final int total;
  final Color accent;
  final IconData icon;
  final bool useLiveCounter;

  @override
  Widget build(BuildContext context) {
    return BentoTile(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 14, color: accent),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SeuColors.gray,
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (useLiveCounter)
                LiveCounter(
                  value: value,
                  minDigits: 2,
                  color: accent,
                  fontSize: 34,
                )
              else
                Text(
                  value.toString().padLeft(2, '0'),
                  style: TextStyle(
                    color: accent,
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.6,
                    height: 1.0,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              const SizedBox(width: 4),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '/$total',
                  style: const TextStyle(
                    color: SeuColors.gray,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SegmentedTabs extends StatelessWidget {
  const _SegmentedTabs({required this.controller, required this.tabs});
  final TabController controller;
  final List<String> tabs;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: SeuRadius.xlR,
        boxShadow: SeuShadow.tile,
      ),
      child: TabBar(
        controller: controller,
        labelColor: SeuColors.white,
        unselectedLabelColor: SeuColors.navy,
        labelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        dividerColor: Colors.transparent,
        indicatorSize: TabBarIndicatorSize.tab,
        indicator: BoxDecoration(
          color: SeuColors.red,
          borderRadius: BorderRadius.circular(999),
        ),
        splashBorderRadius: BorderRadius.circular(999),
        tabs: [
          for (final label in tabs) Tab(text: label),
        ],
      ),
    );
  }
}

class _SessionBottomBar extends StatelessWidget {
  const _SessionBottomBar({required this.onEnd});
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Container(
      decoration: BoxDecoration(
        color: SeuColors.white,
        boxShadow: [
          BoxShadow(
            color: SeuColors.navy.withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, -8),
            spreadRadius: -10,
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: SeuColors.red,
                foregroundColor: SeuColors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: SeuRadius.mdR),
                textStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              icon: const Icon(Icons.stop_circle_outlined, size: 20),
              onPressed: onEnd,
              label: Text(s.t('doctor.endLecture')),
            ),
          ),
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
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.qr_code_scanner_outlined,
                size: 36,
                color: SeuColors.gray.withOpacity(0.6),
              ),
              const SizedBox(height: 10),
              Text(
                emptyLabel,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: SeuColors.gray,
                    ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final e = items[i];
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: SeuColors.white,
            borderRadius: SeuRadius.lgR,
            boxShadow: SeuShadow.tile,
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [SeuColors.navy, Color(0xFF1F1F26)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  e.name
                      .split(' ')
                      .where((p) => p.isNotEmpty)
                      .take(2)
                      .map((p) => p[0])
                      .join()
                      .toUpperCase(),
                  style: const TextStyle(
                    color: SeuColors.gold,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      e.name,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      e.id,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: SeuColors.gray,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                    ),
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
