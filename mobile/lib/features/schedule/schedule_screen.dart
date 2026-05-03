import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth_state.dart';

final scheduleProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiProvider);
  final r = await api.dio.get('/schedule/my');
  return r.data['data']['slots'] as List<dynamic>;
});

class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key});

  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(scheduleProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Schedule')),
      body: async.when(
        data: (slots) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(scheduleProvider),
          child: ListView.separated(
            itemCount: slots.length,
            separatorBuilder: (_, __) => const Divider(height: 0),
            itemBuilder: (context, i) {
              final s = slots[i] as Map<String, dynamic>;
              final day = _days[s['dayOfWeek'] as int];
              return ListTile(
                title: Text(s['subject']?['name'] as String? ?? '—'),
                subtitle: Text('$day · ${s['startTime']} – ${s['endTime']}\n${s['room']?['name'] ?? ''}'),
                isThreeLine: true,
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
