import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// A single lecture entry on the student home / schedule pages.
///
/// Renders a left-edge colour bar (subject identity), subject title, time +
/// room + doctor metadata, and an optional "Current" pulse for the lecture
/// in progress.
class LectureCard extends StatefulWidget {
  const LectureCard({
    super.key,
    required this.subject,
    required this.time,
    required this.room,
    required this.doctor,
    this.accent = SeuColors.red,
    this.isCurrent = false,
    this.onTap,
  });

  final String subject;
  final String time;
  final String room;
  final String doctor;
  final Color accent;
  final bool isCurrent;
  final VoidCallback? onTap;

  @override
  State<LectureCard> createState() => _LectureCardState();
}

class _LectureCardState extends State<LectureCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: SeuRadius.lgR,
        border: Border.all(
          color: widget.isCurrent
              ? SeuColors.success
              : SeuColors.navy.withOpacity(0.06),
          width: widget.isCurrent ? 1.6 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: SeuColors.navy.withOpacity(widget.isCurrent ? 0.10 : 0.04),
            blurRadius: widget.isCurrent ? 20 : 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 56,
            decoration: BoxDecoration(
              color: widget.accent,
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
                        widget.subject,
                        style: Theme.of(context).textTheme.titleLarge,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (widget.isCurrent)
                      _LiveDot()
                    else
                      Text(
                        widget.time,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              fontFeatures: const [FontFeature.tabularFigures()],
                            ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${widget.room} · ${widget.doctor}',
                  style: Theme.of(context).textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (widget.isCurrent) ...[
                  const SizedBox(height: 6),
                  Text(
                    'In progress · ${widget.time}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SeuColors.success,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: widget.isCurrent
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
          const Text(
            'LIVE',
            style: TextStyle(
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
