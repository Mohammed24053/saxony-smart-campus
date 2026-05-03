import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth_state.dart';

final notificationsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiProvider);
  final r = await api.dio.get('/notifications');
  return r.data['data']['items'] as List<dynamic>;
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: async.when(
        data: (items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(notificationsProvider),
          child: ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 0),
            itemBuilder: (context, i) {
              final n = items[i] as Map<String, dynamic>;
              return ListTile(
                title: Text(n['title'] as String? ?? ''),
                subtitle: Text(n['body'] as String? ?? ''),
                trailing: (n['isRead'] as bool? ?? false)
                    ? const Icon(Icons.check, color: Colors.grey)
                    : const Icon(Icons.fiber_new, color: Colors.blue),
              );
            },
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}
