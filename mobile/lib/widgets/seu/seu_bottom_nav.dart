import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// SEU bottom navigation bar.
///
/// On selection: the active icon springs scale 1 → 1.3 → 1 over 280ms (bounce
/// curve), and a gold dot fades + slides into place beneath it.
class SeuBottomNav extends StatelessWidget {
  const SeuBottomNav({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<SeuNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: SeuColors.white,
      elevation: 0,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _NavTile(
                    item: items[i],
                    selected: i == selectedIndex,
                    onTap: () => onSelected(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class SeuNavItem {
  const SeuNavItem({required this.icon, required this.label, this.activeIcon});
  final IconData icon;
  final IconData? activeIcon;
  final String label;
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.item,
    required this.selected,
    required this.onTap,
  });
  final SeuNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: SeuRadius.lgR,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _BounceIcon(
                  icon: selected ? (item.activeIcon ?? item.icon) : item.icon,
                  selected: selected,
                ),
                const SizedBox(height: 2),
                Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    color: selected ? SeuColors.red : SeuColors.gray,
                  ),
                ),
                const SizedBox(height: 2),
                AnimatedSlide(
                  offset: selected ? Offset.zero : const Offset(0, 0.4),
                  duration: const Duration(milliseconds: 220),
                  curve: SeuMotion.enter,
                  child: AnimatedOpacity(
                    opacity: selected ? 1 : 0,
                    duration: const Duration(milliseconds: 220),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: SeuColors.gold,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BounceIcon extends StatefulWidget {
  const _BounceIcon({required this.icon, required this.selected});
  final IconData icon;
  final bool selected;

  @override
  State<_BounceIcon> createState() => _BounceIconState();
}

class _BounceIconState extends State<_BounceIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 320),
  );

  @override
  void didUpdateWidget(covariant _BounceIcon old) {
    super.didUpdateWidget(old);
    if (widget.selected && !old.selected) {
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
    final scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.3), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.3, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    return AnimatedBuilder(
      animation: scale,
      builder: (_, __) => Transform.scale(
        scale: widget.selected ? scale.value : 1.0,
        child: Icon(
          widget.icon,
          size: 24,
          color: widget.selected ? SeuColors.red : SeuColors.gray,
        ),
      ),
    );
  }
}
