import 'package:flutter/material.dart';

import '../../core/strings.dart';
import '../../theme/app_theme.dart';

enum AttendanceTone { present, late, absent, warning1, warning2, deprivation }

/// Compact status pill mirroring the web `<StatusBadge>` component.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.tone, this.label});

  final AttendanceTone tone;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final (bg, fg, icon, defaultLabel) = switch (tone) {
      AttendanceTone.present => (
          SeuColors.success.withOpacity(0.12),
          SeuColors.success,
          Icons.check_circle_outline,
          s.t('attendance.present'),
        ),
      AttendanceTone.late => (
          SeuColors.gold.withOpacity(0.20),
          const Color(0xFF7A5D10),
          Icons.access_time,
          s.t('attendance.late'),
        ),
      AttendanceTone.absent => (
          SeuColors.danger.withOpacity(0.10),
          SeuColors.danger,
          Icons.cancel_outlined,
          s.t('attendance.absent'),
        ),
      AttendanceTone.warning1 => (
          SeuColors.gold.withOpacity(0.20),
          const Color(0xFF7A5D10),
          Icons.warning_amber_rounded,
          s.t('attendance.warning1'),
        ),
      AttendanceTone.warning2 => (
          const Color(0xFFF6A03C).withOpacity(0.18),
          const Color(0xFF8B4500),
          Icons.warning_rounded,
          s.t('attendance.warning2'),
        ),
      AttendanceTone.deprivation => (
          SeuColors.danger.withOpacity(0.12),
          SeuColors.danger,
          Icons.block,
          s.t('attendance.deprivation'),
        ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: SeuRadius.xlR,
        border: Border.all(color: fg.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(
            label ?? defaultLabel,
            style: TextStyle(
              color: fg,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
