import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/strings.dart';
import '../../theme/app_theme.dart';

final connectivityProvider = StreamProvider<bool>((ref) async* {
  // Emit current state immediately.
  final result = await Connectivity().checkConnectivity();
  yield !_isOffline(result);
  await for (final r in Connectivity().onConnectivityChanged) {
    yield !_isOffline(r);
  }
});

bool _isOffline(List<ConnectivityResult> r) =>
    r.isEmpty || r.every((e) => e == ConnectivityResult.none);

/// Sticky offline banner. Slides down from the top with an amber wave when
/// the device loses connectivity; slides back up smoothly when it returns.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(connectivityProvider).maybeWhen(
          data: (v) => v,
          orElse: () => true,
        );
    return AnimatedSize(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      child: online
          ? const SizedBox.shrink()
          : Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              color: SeuColors.gold,
              child: Row(
                children: [
                  const Icon(Icons.wifi_off, size: 18, color: SeuColors.navy),
                  const SizedBox(width: 8),
                  Text(
                    AppStrings.of(context).t('common.offline'),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SeuColors.navy,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            ),
    );
  }
}

/// Convenient stream-controller wrapper if you don't want to depend on Riverpod.
class ConnectivityNotifier extends ChangeNotifier {
  ConnectivityNotifier() {
    _sub = Connectivity().onConnectivityChanged.listen((r) {
      online = !_isOffline(r);
      notifyListeners();
    });
    Connectivity().checkConnectivity().then((r) {
      online = !_isOffline(r);
      notifyListeners();
    });
  }

  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool online = true;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
