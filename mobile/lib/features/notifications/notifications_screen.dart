import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';

final notificationsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiProvider);
  final r = await api.dio.get('/notifications');
  return r.data['data']['items'] as List<dynamic>;
});

enum _NotifKind { general, postponed, cancelled, warning }

_NotifKind _kindFromTitle(String title) {
  final t = title.toLowerCase();
  if (t.contains('postpone')) return _NotifKind.postponed;
  if (t.contains('cancel')) return _NotifKind.cancelled;
  if (t.contains('warn') || t.contains('absent')) return _NotifKind.warning;
  return _NotifKind.general;
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  Map<String, List<Map<String, dynamic>>> _grouped(List<dynamic> items) {
    final fmt = DateFormat.yMMMMd();
    final map = <String, List<Map<String, dynamic>>>{};
    for (final raw in items) {
      final n = raw as Map<String, dynamic>;
      final dt = DateTime.tryParse(n['createdAt']?.toString() ?? '') ??
          DateTime.now();
      final key = fmt.format(dt);
      map.putIfAbsent(key, () => []).add(n);
    }
    return map;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    final s = AppStrings.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('notifications.title')),
        actions: [
          TextButton(
            onPressed: () {},
            child: Text(
              s.t('notifications.markAllRead'),
              style: const TextStyle(color: SeuColors.gold),
            ),
          ),
        ],
      ),
      body: async.when(
        data: (items) {
          if (items.isEmpty) return const _EmptyNotifs();
          final groups = _grouped(items);
          return RefreshIndicator(
            color: SeuColors.red,
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                for (final entry in groups.entries) ...[
                  Padding(
                    padding: const EdgeInsets.only(top: 12, bottom: 6),
                    child: Text(
                      entry.key,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: SeuColors.gray,
                            letterSpacing: 0.5,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                  for (var i = 0; i < entry.value.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _NotifCard(notif: entry.value[i])
                          .animate()
                          .slideX(
                            begin: 0.08,
                            end: 0,
                            duration: const Duration(milliseconds: 240),
                            curve: SeuMotion.enter,
                          )
                          .fadeIn(
                              duration: const Duration(milliseconds: 240)),
                    ),
                ],
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(s.fill('common.errorPrefix', {'message': e.toString()})),
        ),
      ),
    );
  }
}

class _EmptyNotifs extends StatelessWidget {
  const _EmptyNotifs();
  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: SeuColors.gold.withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.notifications_off,
                size: 36, color: SeuColors.gold),
          ),
          const SizedBox(height: 12),
          Text(
            s.t('notifications.allCaughtUp'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            s.t('notifications.newWillAppear'),
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: SeuColors.gray),
          ),
        ],
      ),
    );
  }
}

class _NotifCard extends StatelessWidget {
  const _NotifCard({required this.notif});
  final Map<String, dynamic> notif;

  @override
  Widget build(BuildContext context) {
    final title = notif['title']?.toString() ?? '';
    final body = notif['body']?.toString() ?? '';
    final isRead = notif['isRead'] as bool? ?? false;
    final kind = _kindFromTitle(title);
    final (icon, color) = switch (kind) {
      _NotifKind.general => (Icons.campaign, SeuColors.info),
      _NotifKind.postponed => (Icons.schedule, SeuColors.gold),
      _NotifKind.cancelled => (Icons.cancel_outlined, SeuColors.danger),
      _NotifKind.warning => (Icons.warning_amber_rounded, SeuColors.danger),
    };
    return Dismissible(
      key: ValueKey(notif['id'] ?? UniqueKey()),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: SeuColors.danger,
          borderRadius: SeuRadius.lgR,
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isRead ? SeuColors.white : null,
          borderRadius: SeuRadius.lgR,
          boxShadow: SeuShadow.tile,
          // Unread tiles get a faint gold-tinted backwash so they sit slightly
          // forward in the visual hierarchy without breaking the bento system.
          gradient: isRead
              ? null
              : LinearGradient(
                  colors: [
                    SeuColors.white,
                    SeuColors.gold.withOpacity(0.05),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: color, size: 20),
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
                          title.isEmpty
                              ? AppStrings.of(context).t('notifications.noTitle')
                              : title,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontSize: 15,
                              ),
                        ),
                      ),
                      if (!isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: SeuColors.info,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
