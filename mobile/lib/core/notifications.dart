import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';

/// Background message handler — must be a top-level function annotated with
/// [pragma('vm:entry-point')] so Flutter can register it on the FCM isolate.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Ensure Firebase is initialised in the background isolate. If the host
  // app didn't ship a `firebase_options.dart`, this no-ops gracefully.
  try {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp();
  } catch (_) {/* ignore — pure background notifications still display */}
}

class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  final _localPlugin = FlutterLocalNotificationsPlugin();
  final _onTapController = StreamController<RemoteMessage>.broadcast();
  bool _initialized = false;

  /// Stream of message taps for in-app deep linking.
  Stream<RemoteMessage> get onTap => _onTapController.stream;

  /// Wires up Firebase + foreground notifications. Safe to call without
  /// `firebase_options.dart`: if Firebase fails to init we log and bail
  /// (push will simply be a no-op until Firebase is configured).
  Future<void> init({required ApiClient api}) async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('[push] Firebase init skipped: $e');
      return;
    }

    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

    // Local-notifications plugin for foreground surfacing.
    const init = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      ),
    );
    await _localPlugin.initialize(init);

    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    debugPrint('[push] permission status: ${settings.authorizationStatus}');

    // Register the device token with the backend. Re-register on rotation.
    final token = await messaging.getToken();
    if (token != null) await _registerToken(api, token);
    messaging.onTokenRefresh.listen((t) => _registerToken(api, t));

    // Foreground messages → display via flutter_local_notifications.
    FirebaseMessaging.onMessage.listen((RemoteMessage m) async {
      final n = m.notification;
      if (n == null) return;
      const details = NotificationDetails(
        android: AndroidNotificationDetails(
          'seu_default',
          'General',
          channelDescription: 'Saxony Smart Campus notifications',
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      );
      await _localPlugin.show(
        n.hashCode,
        n.title,
        n.body,
        details,
        payload: m.data['type'] as String?,
      );
    });

    // Tap handlers (terminated state + background → tap).
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) _onTapController.add(initialMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_onTapController.add);

    _initialized = true;
  }

  Future<void> _registerToken(ApiClient api, String token) async {
    try {
      await api.dio.post('/me/devices', data: {
        'token': token,
        'platform': defaultTargetPlatform.name.toLowerCase(),
      });
    } catch (e) {
      // Soft-fail — the user can still receive push when the token rotates.
      debugPrint('[push] device-token register failed: $e');
    }
  }
}

/// Convenient riverpod provider for the singleton service.
final pushServiceProvider = Provider<PushNotificationService>(
  (_) => PushNotificationService.instance,
);
