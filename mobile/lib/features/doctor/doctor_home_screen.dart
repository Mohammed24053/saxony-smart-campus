import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';
import '../../widgets/seu/bento_tile.dart';
import '../../widgets/seu/offline_banner.dart';

/// Doctor's "today" landing screen.
///
/// Bento-tile aesthetic mirroring the student home: greeting tile with avatar,
/// navy gradient hero tile that counts down to the next lecture, quick-stats
/// row, and a list of today's lectures. Each card opens the active-session
/// screen via the "Start lecture" CTA; the in-progress lecture pulses green.
class DoctorHomeScreen extends ConsumerStatefulWidget {
  const DoctorHomeScreen({super.key});

  @override
  ConsumerState<DoctorHomeScreen> createState() => _DoctorHomeScreenState();
}

class _DoctorHomeScreenState extends ConsumerState<DoctorHomeScreen> {
  late Future<List<_TodaySlot>> _futureSlots;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _futureSlots = _fetch();
    // Re-render every 30s so countdowns and in-progress states stay current.
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
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

  String _greetingKey() {
    final h = DateTime.now().hour;
    if (h < 12) return 'home.goodMorning';
    if (h < 17) return 'home.goodAfternoon';
    return 'home.goodEvening';
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final user = ref.watch(authProvider);
    final theme = Theme.of(context);
    final firstName = (user?.name.split(' ').first ?? '').trim().isEmpty
        ? s.t('doctor.welcomeFallback')
        : user!.name.split(' ').first;

    return Scaffold(
      backgroundColor: SeuColors.cream,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const OfflineBanner(),
            Expanded(
              child: RefreshIndicator(
                color: SeuColors.red,
                onRefresh: () async {
                  setState(() => _futureSlots = _fetch());
                  await _futureSlots;
                },
                child: FutureBuilder<List<_TodaySlot>>(
                  future: _futureSlots,
                  builder: (context, snap) {
                    final loading =
                        snap.connectionState == ConnectionState.waiting;
                    final slots = snap.data ?? const <_TodaySlot>[];
                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                      children: [
                        _GreetingTile(
                          greeting: s.t(_greetingKey()),
                          name: 'Dr. $firstName',
                          dateLabel: DateFormat('EEEE, MMMM d')
                              .format(DateTime.now()),
                          onLogout: () async {
                            await ref.read(authProvider.notifier).logout();
                            if (context.mounted) context.go('/login');
                          },
                        ),
                        const SizedBox(height: 12),
                        if (loading)
                          const _NextLectureSkeleton()
                        else
                          _NextLectureHero(slots: slots),
                        const SizedBox(height: 12),
                        if (!loading) _QuickStatsRow(slots: slots),
                        const SizedBox(height: 16),
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                              start: 4, bottom: 8),
                          child: Row(
                            children: [
                              Text(
                                s.t('doctor.todayTitle'),
                                style: theme.textTheme.titleLarge,
                              ),
                              const SizedBox(width: 8),
                              BentoLabel(text: s.t('doctor.todayLabel')),
                            ],
                          ),
                        ),
                        if (loading)
                          const _LectureListSkeleton()
                        else if (slots.isEmpty)
                          _EmptyTile(label: s.t('home.todayEmpty'))
                        else
                          _LectureList(slots: slots),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Top "who's logged in + when" tile. Carries the logout affordance (the
/// doctor screen has no app bar in round 2).
class _GreetingTile extends StatelessWidget {
  const _GreetingTile({
    required this.greeting,
    required this.name,
    required this.dateLabel,
    required this.onLogout,
  });

  final String greeting;
  final String name;
  final String dateLabel;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final s = AppStrings.of(context);
    final initials = name
        .replaceAll('Dr.', '')
        .trim()
        .split(' ')
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0])
        .join()
        .toUpperCase();
    return BentoTile(
      padding: const EdgeInsetsDirectional.fromSTEB(20, 18, 12, 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [SeuColors.navy, Color(0xFF1F1F26)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Text(
              initials.isEmpty ? 'DR' : initials,
              style: const TextStyle(
                color: SeuColors.gold,
                fontWeight: FontWeight.w800,
                fontSize: 14,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  greeting,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: SeuColors.gray,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  name,
                  style: theme.textTheme.titleLarge,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  dateLabel,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: SeuColors.gray,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: s.t('auth.signOut'),
            onPressed: onLogout,
            icon: const Icon(Icons.logout, color: SeuColors.gray),
          ),
        ],
      ),
    );
  }
}

/// Navy gradient hero — counts down to the next lecture or surfaces the
/// in-progress one. Tapping anywhere opens the active-session screen.
class _NextLectureHero extends StatelessWidget {
  const _NextLectureHero({required this.slots});
  final List<_TodaySlot> slots;

  String _format(BuildContext context, Duration d) {
    final s = AppStrings.of(context);
    if (d.isNegative) return s.t('home.inProgress');
    if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes % 60}m';
    if (d.inMinutes > 0) return '${d.inMinutes}m';
    return s.t('home.now');
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final theme = Theme.of(context);
    final now = DateTime.now();
    _TodaySlot? current;
    _TodaySlot? next;
    for (final slot in slots) {
      final start = slot.startsAt(now);
      final end = slot.endsAt(now);
      if (start == null || end == null) continue;
      if (start.isBefore(now) && end.isAfter(now)) {
        current = slot;
        break;
      }
      if (start.isAfter(now)) {
        final nextStart = next?.startsAt(now);
        if (next == null || (nextStart != null && start.isBefore(nextStart))) {
          next = slot;
        }
      }
    }
    final target = current ?? next;
    if (target == null) {
      return BentoTile(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
        child: Row(
          children: [
            const Icon(Icons.celebration, color: SeuColors.gold, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                s.t('home.allCaughtUp'),
                style: theme.textTheme.titleLarge,
              ),
            ),
          ],
        ),
      );
    }
    final isLive = current != null;
    final remaining = isLive
        ? target.endsAt(now)!.difference(now)
        : target.startsAt(now)!.difference(now);
    return BentoTile(
      lift: true,
      gradient: const LinearGradient(
        colors: [SeuColors.navy, Color(0xFF1F1F26)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(SeuRadius.xl),
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      onTap: () => context.go('/doctor/active', extra: {
        'subject': target.subject,
        'section': target.section,
        'room': target.room,
        'slotId': target.slotId,
      }),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isLive ? SeuColors.success : SeuColors.gold,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                isLive ? s.t('common.live') : s.t('doctor.lectureStartsIn'),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: isLive ? SeuColors.success : SeuColors.gold,
                  letterSpacing: 1.4,
                  fontWeight: FontWeight.w700,
                  fontSize: 10,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _format(context, remaining),
            style: const TextStyle(
              color: SeuColors.white,
              fontSize: 40,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              height: 1.0,
            ),
          ).animate().fadeIn(duration: const Duration(milliseconds: 250)),
          const SizedBox(height: 10),
          Text(
            target.subject,
            style: const TextStyle(
              color: SeuColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.place_outlined,
                  size: 14, color: SeuColors.cream),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  '${target.section} · ${target.room} · ${target.time}',
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
          const SizedBox(height: 14),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: SeuColors.red,
                foregroundColor: SeuColors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: SeuRadius.mdR),
                textStyle: const TextStyle(fontWeight: FontWeight.w600),
              ),
              icon: Icon(
                isLive ? Icons.bolt_rounded : Icons.play_arrow_rounded,
                size: 18,
              ),
              onPressed: () => context.go('/doctor/active', extra: {
                'subject': target.subject,
                'section': target.section,
                'room': target.room,
                'slotId': target.slotId,
              }),
              label: Text(s.t('doctor.startLecture')),
            ),
          ),
        ],
      ),
    );
  }
}

class _NextLectureSkeleton extends StatelessWidget {
  const _NextLectureSkeleton();
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 168,
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

/// Two side-by-side bento tiles summarising today's caseload at a glance.
class _QuickStatsRow extends StatelessWidget {
  const _QuickStatsRow({required this.slots});
  final List<_TodaySlot> slots;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final upcoming = slots.where((slot) {
      final start = slot.startsAt(now);
      return start != null && start.isAfter(now);
    }).length;
    final inProgress = slots.where((slot) {
      final start = slot.startsAt(now);
      final end = slot.endsAt(now);
      if (start == null || end == null) return false;
      return start.isBefore(now) && end.isAfter(now);
    }).length;

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
  const _LectureList({required this.slots});
  final List<_TodaySlot> slots;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < slots.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _DoctorLectureCard(slot: slots[i])
                .animate()
                .fadeIn(
                  delay: Duration(milliseconds: i * 40),
                  duration: const Duration(milliseconds: 260),
                )
                .slideX(
                  begin: 0.08,
                  end: 0,
                  delay: Duration(milliseconds: i * 40),
                  duration: const Duration(milliseconds: 260),
                  curve: SeuMotion.enter,
                ),
          ),
      ],
    );
  }
}

class _DoctorLectureCard extends StatefulWidget {
  const _DoctorLectureCard({required this.slot});
  final _TodaySlot slot;

  @override
  State<_DoctorLectureCard> createState() => _DoctorLectureCardState();
}

class _DoctorLectureCardState extends State<_DoctorLectureCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  )..repeat(reverse: true);
  bool _pressed = false;

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  bool _isCurrent() {
    final now = DateTime.now();
    final start = widget.slot.startsAt(now);
    final end = widget.slot.endsAt(now);
    if (start == null || end == null) return false;
    return start.isBefore(now) && end.isAfter(now);
  }

  bool _isPast() {
    final now = DateTime.now();
    final end = widget.slot.endsAt(now);
    if (end == null) return false;
    return end.isBefore(now);
  }

  void _open() {
    context.go('/doctor/active', extra: {
      'subject': widget.slot.subject,
      'section': widget.slot.section,
      'room': widget.slot.room,
      'slotId': widget.slot.slotId,
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final theme = Theme.of(context);
    final current = _isCurrent();
    final past = _isPast();
    final accent =
        current ? SeuColors.success : (past ? SeuColors.gray : SeuColors.red);

    final card = AnimatedScale(
      scale: _pressed ? 0.98 : 1.0,
      duration: const Duration(milliseconds: 140),
      curve: SeuMotion.spring,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: SeuColors.white,
          borderRadius: SeuRadius.lgR,
          boxShadow: current ? SeuShadow.tileLift : SeuShadow.tile,
        ),
        child: Row(
          children: [
            Container(
              width: 4,
              height: 72,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.slot.subject,
                          style: theme.textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (current)
                        _LiveDot()
                      else
                        Text(
                          widget.slot.time,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: past ? SeuColors.gray : SeuColors.navy,
                            fontFeatures: const [
                              FontFeature.tabularFigures(),
                            ],
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.groups_outlined,
                          size: 13, color: SeuColors.gray),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          widget.slot.section,
                          style: theme.textTheme.bodySmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Icon(Icons.place_outlined,
                          size: 13, color: SeuColors.gray),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          widget.slot.room,
                          style: theme.textTheme.bodySmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: past
                            ? SeuColors.gray.withOpacity(0.20)
                            : SeuColors.red,
                        foregroundColor:
                            past ? SeuColors.gray : SeuColors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(
                            borderRadius: SeuRadius.mdR),
                        textStyle:
                            const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      icon: Icon(
                        current
                            ? Icons.bolt_rounded
                            : (past ? Icons.replay : Icons.play_arrow_rounded),
                        size: 16,
                      ),
                      onPressed: _open,
                      label: Text(s.t('doctor.startLecture')),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: _open,
      behavior: HitTestBehavior.opaque,
      child: current
          ? AnimatedBuilder(
              animation: _pulse,
              builder: (_, __) => Container(
                decoration: BoxDecoration(
                  borderRadius: SeuRadius.lgR,
                  boxShadow: [
                    BoxShadow(
                      color: SeuColors.success
                          .withOpacity(0.18 + 0.18 * _pulse.value),
                      blurRadius: 24 + 12 * _pulse.value,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: card,
              ),
            )
          : card,
    );
  }
}

class _LiveDot extends StatefulWidget {
  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot>
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
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: SeuColors.success.withOpacity(0.5 + 0.5 * _ctrl.value),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            AppStrings.of(context).t('common.live'),
            style: const TextStyle(
              color: SeuColors.success,
              fontWeight: FontWeight.w700,
              fontSize: 11,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
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
              height: 96,
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

class _EmptyTile extends StatelessWidget {
  const _EmptyTile({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) {
    return BentoTile(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          const Icon(Icons.celebration, color: SeuColors.gold, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _TodaySlot {
  final String slotId;
  final String subject;
  final String section;
  final String room;
  final String time;
  final String? startTime;
  final String? endTime;

  _TodaySlot({
    required this.slotId,
    required this.subject,
    required this.section,
    required this.room,
    required this.time,
    this.startTime,
    this.endTime,
  });

  factory _TodaySlot.fromJson(Map<String, dynamic> j) {
    final st = (j['startTime'] as String?) ?? '';
    final et = (j['endTime'] as String?) ?? '';
    return _TodaySlot(
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
      time: '$st – $et',
      startTime: st.isEmpty ? null : st,
      endTime: et.isEmpty ? null : et,
    );
  }

  DateTime? _parse(String? t, DateTime now) {
    if (t == null || t.isEmpty) return null;
    final parts = t.split(':');
    if (parts.length < 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return DateTime(now.year, now.month, now.day, h, m);
  }

  DateTime? startsAt(DateTime now) => _parse(startTime, now);
  DateTime? endsAt(DateTime now) => _parse(endTime, now);
}
