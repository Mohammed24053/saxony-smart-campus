import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth_state.dart';

final historyProvider = FutureProvider<List<dynamic>>((ref) async {
  final user = ref.read(authProvider);
  if (user == null) return const [];
  final api = ref.read(apiProvider);
  final r = await api.dio.get('/attendance/student/${user.id}');
  return r.data['data']['items'] as List<dynamic>;
});

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(historyProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance history')),
      body: async.when(
        data: (items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(historyProvider),
          child: ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 0),
            itemBuilder: (context, i) {
              final r = items[i] as Map<String, dynamic>;
              return ListTile(
                title: Text(r['session']?['scheduleSlot']?['subject']?['name'] as String? ?? '—'),
                subtitle: Text(r['scannedAt']?.toString() ?? r['createdAt']?.toString() ?? ''),
                trailing: Text(r['status'] as String? ?? ''),
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
