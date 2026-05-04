import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// Bento-style tile (round 2 mobile redesign).
///
/// Provides a borderless, pillow-y card with soft layered shadows, optional
/// tap handling that scales to 0.98 with a spring curve, and an accent strip
/// for category coding. Use as the base for every dashboard surface so the
/// home/schedule/history screens share a consistent surface vocabulary.
///
/// Example:
/// ```dart
/// BentoTile(
///   onTap: () => context.go('/schedule'),
///   child: Padding(
///     padding: const EdgeInsets.all(SeuSpacing.lg),
///     child: Text('Today'),
///   ),
/// )
/// ```
class BentoTile extends StatefulWidget {
  const BentoTile({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
    this.color,
    this.gradient,
    this.borderRadius,
    this.shadow,
    this.lift = false,
    this.accent,
    this.height,
    this.width,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final Gradient? gradient;
  final BorderRadius? borderRadius;
  final List<BoxShadow>? shadow;

  /// Use the heavier shadow stack (for hero/feature tiles).
  final bool lift;

  /// Optional gold/red accent strip on the left edge (RTL-aware).
  final Color? accent;

  final double? height;
  final double? width;

  @override
  State<BentoTile> createState() => _BentoTileState();
}

class _BentoTileState extends State<BentoTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? SeuRadius.lgR;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    final tile = AnimatedScale(
      scale: _pressed ? 0.98 : 1.0,
      duration: const Duration(milliseconds: 140),
      curve: SeuMotion.spring,
      child: AnimatedContainer(
        duration: SeuMotion.fast,
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: widget.gradient == null ? (widget.color ?? SeuColors.white) : null,
          gradient: widget.gradient,
          borderRadius: radius,
          boxShadow: widget.shadow ??
              (widget.lift ? SeuShadow.tileLift : SeuShadow.tile),
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: Stack(
            children: [
              if (widget.accent != null)
                Positioned(
                  top: 0,
                  bottom: 0,
                  left: isRtl ? null : 0,
                  right: isRtl ? 0 : null,
                  child: Container(width: 4, color: widget.accent),
                ),
              Padding(
                padding: widget.padding ?? const EdgeInsets.all(SeuSpacing.lg),
                child: widget.child,
              ),
            ],
          ),
        ),
      ),
    );

    if (widget.onTap == null) return tile;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: tile,
    );
  }
}

/// Helper widget: a small pill label used inside bento tiles to denote category
/// (e.g. "Today", "Schedule", "Attendance"). Echoes the SEU brand pattern.
class BentoLabel extends StatelessWidget {
  const BentoLabel({super.key, required this.text, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? SeuColors.red;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withOpacity(0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: c,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
