import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Circular ring chart showing attendance percentage for a subject.
///
/// On screen entry the ring sweeps from 0 → [percent] over 800ms with
/// `easeOutCubic`, then settles. Color shifts based on threshold:
///   ≥ 75%: success green
///   ≥ 60%: gold
///   < 60%: SEU red (with subtle pulse to flag risk).
class AttendanceRing extends StatefulWidget {
  const AttendanceRing({
    super.key,
    required this.percent,
    this.size = 88,
    this.label,
  });

  final double percent; // 0..1
  final double size;
  final String? label;

  Color get _toneColor {
    if (percent >= 0.75) return SeuColors.success;
    if (percent >= 0.60) return SeuColors.gold;
    return SeuColors.danger;
  }

  @override
  State<AttendanceRing> createState() => _AttendanceRingState();
}

class _AttendanceRingState extends State<AttendanceRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _value;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: SeuMotion.xslow,
    );
    _value = Tween<double>(begin: 0, end: widget.percent.clamp(0, 1)).animate(
      CurvedAnimation(parent: _ctrl, curve: SeuMotion.enter),
    );
    _ctrl.forward();
  }

  @override
  void didUpdateWidget(covariant AttendanceRing old) {
    super.didUpdateWidget(old);
    if (old.percent != widget.percent) {
      _ctrl
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _value,
      builder: (_, __) {
        final pct = _value.value;
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: Size.square(widget.size),
                painter: _RingPainter(
                  value: pct,
                  color: widget._toneColor,
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${(pct * 100).round()}%',
                    style: TextStyle(
                      color: SeuColors.navy,
                      fontWeight: FontWeight.w700,
                      fontSize: widget.size * 0.22,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  if (widget.label != null)
                    Text(
                      widget.label!,
                      style: const TextStyle(
                        color: SeuColors.gray,
                        fontSize: 11,
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.value, required this.color});
  final double value;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide / 2) - 6;
    final track = Paint()
      ..color = SeuColors.navy.withOpacity(0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8;
    final value = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 8;
    canvas.drawCircle(center, radius, track);
    final start = -math.pi / 2;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      start,
      math.pi * 2 * this.value,
      false,
      value,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) =>
      old.value != value || old.color != color;
}
