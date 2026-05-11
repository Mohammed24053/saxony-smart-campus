import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Scoreboard-style counter that flips individual digits when the value
/// changes — used on doctor active-session and live attendance views.
class LiveCounter extends StatelessWidget {
  const LiveCounter({
    super.key,
    required this.value,
    this.minDigits = 2,
    this.color = SeuColors.navy,
    this.fontSize = 56,
  });

  final int value;
  final int minDigits;
  final Color color;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final str = value.toString().padLeft(minDigits, '0');
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (final ch in str.split(''))
          _FlipDigit(digit: ch, fontSize: fontSize, color: color),
      ],
    );
  }
}

class _FlipDigit extends StatelessWidget {
  const _FlipDigit({
    required this.digit,
    required this.fontSize,
    required this.color,
  });

  final String digit;
  final double fontSize;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, anim) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, -0.35),
            end: Offset.zero,
          ).animate(anim),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
      child: SizedBox(
        key: ValueKey(digit),
        width: fontSize * 0.65,
        child: Text(
          digit,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: color,
            fontSize: fontSize,
            fontWeight: FontWeight.w800,
            fontFeatures: const [FontFeature.tabularFigures()],
            height: 1.0,
          ),
        ),
      ),
    );
  }
}
