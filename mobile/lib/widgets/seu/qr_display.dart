import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../theme/app_theme.dart';

/// Doctor-side QR display widget.
///
/// Renders the rotating QR payload with a circular countdown ring around it
/// representing the time-to-next-rotation.
class QrDisplayWidget extends StatelessWidget {
  const QrDisplayWidget({
    super.key,
    required this.payload,
    required this.secondsRemaining,
    required this.rotationSeconds,
    this.size = 240,
  });

  final String payload;
  final int secondsRemaining;
  final int rotationSeconds;
  final double size;

  @override
  Widget build(BuildContext context) {
    final pct = rotationSeconds == 0
        ? 0.0
        : (secondsRemaining / rotationSeconds).clamp(0.0, 1.0);
    return SizedBox(
      width: size + 40,
      height: size + 40,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size + 32,
            height: size + 32,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: pct, end: pct),
              duration: const Duration(milliseconds: 250),
              builder: (_, v, __) => CircularProgressIndicator(
                value: v,
                strokeWidth: 6,
                backgroundColor: SeuColors.navy.withOpacity(0.08),
                valueColor: const AlwaysStoppedAnimation(SeuColors.red),
              ),
            ),
          ),
          Container(
            width: size,
            height: size,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: SeuColors.white,
              borderRadius: SeuRadius.lgR,
              boxShadow: [
                BoxShadow(
                  color: SeuColors.navy.withOpacity(0.10),
                  blurRadius: 24,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: QrImageView(
              data: payload,
              version: QrVersions.auto,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: SeuColors.navy,
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: SeuColors.navy,
              ),
            ),
          ),
          Positioned(
            bottom: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: SeuColors.red,
                borderRadius: SeuRadius.xlR,
              ),
              child: Text(
                'Rotates in ${secondsRemaining}s',
                style: const TextStyle(
                  color: SeuColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
