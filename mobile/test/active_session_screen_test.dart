import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:saxony_smart_campus/core/api_client.dart';
import 'package:saxony_smart_campus/features/doctor/active_session_screen.dart';

import 'test_helpers.dart';

/// Stubs both POST /attendance/session/start and the rotating QR refresh
/// so we can drive ActiveSessionScreen end-to-end without a backend.
Dio _doctorFlowDio({
  required String sessionId,
  required String payload,
  required List<Map<String, Object?>> recordedRequests,
}) {
  final dio = Dio();
  dio.interceptors.clear();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        recordedRequests.add({
          'method': options.method,
          'path': options.path,
          'data': options.data,
        });
        if (options.method == 'POST' && options.path == '/attendance/session/start') {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': {
                  'id': sessionId,
                  'qrPayload': payload,
                  'intervalSeconds': 30,
                },
              },
            ),
          );
        }
        if (options.method == 'GET' &&
            options.path == '/attendance/session/$sessionId/qr') {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': {'payload': 'next:$payload', 'intervalSeconds': 30},
              },
            ),
          );
        }
        if (options.method == 'POST' &&
            options.path == '/attendance/session/$sessionId/end') {
          return handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'data': {'status': 'closed'}},
            ),
          );
        }
        return handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {'data': const {}},
          ),
        );
      },
    ),
  );
  return dio;
}

void main() {
  testWidgets(
    'happy path: starts a session, renders QR, end lecture posts to backend',
    (tester) async {
      const sessionId = 'session-test-1';
      const payload = 'qr-payload-1';
      final calls = <Map<String, Object?>>[];

      await tester.pumpWidget(
        bootstrap(
          const ActiveSessionScreen(
            subject: 'Operating Systems',
            section: 'CS-301-A',
            room: 'Hall B',
            slotId: 'slot-test-1',
          ),
          overrides: [
            fakeAuthOverride(fakeAuthUser(role: 'doctor', name: 'Dr Hany')),
            apiProvider.overrideWith(
              (_) => ApiClient.fromDio(
                _doctorFlowDio(
                  sessionId: sessionId,
                  payload: payload,
                  recordedRequests: calls,
                ),
              ),
            ),
          ],
        ),
      );

      // Let initState fire + the start-session POST settle.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();

      // The screen should have POSTed /attendance/session/start with the slot.
      final startCall = calls.firstWhere(
        (c) => c['path'] == '/attendance/session/start',
        orElse: () => const {},
      );
      expect(
        startCall['method'],
        'POST',
        reason: '/attendance/session/start should be POSTed on entry',
      );
      final body = (startCall['data'] as Map?) ?? const {};
      expect(body['scheduleSlotId'], 'slot-test-1');

      // The subject + section header should be visible.
      expect(find.text('Operating Systems'), findsOneWidget);

      // Tap End lecture and verify the end POST fires.
      await tester.tap(find.byIcon(Icons.stop_circle_outlined));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      final endCall = calls.firstWhere(
        (c) => c['path'] == '/attendance/session/$sessionId/end',
        orElse: () => const {},
      );
      expect(
        endCall['method'],
        'POST',
        reason:
            'tapping End lecture must POST /attendance/session/<id>/end '
            'so the backend closes the session + queues the at-risk job',
      );
    },
  );

  testWidgets(
    'demo mode (no slotId): does NOT POST to the backend, just renders chrome',
    (tester) async {
      final calls = <Map<String, Object?>>[];

      await tester.pumpWidget(
        bootstrap(
          const ActiveSessionScreen(
            subject: 'Demo subject',
            section: 'Demo section',
            room: 'Demo room',
            // no slotId → screen falls back to demo ticker
          ),
          overrides: [
            fakeAuthOverride(fakeAuthUser(role: 'doctor')),
            apiProvider.overrideWith(
              (_) => ApiClient.fromDio(
                _doctorFlowDio(
                  sessionId: 'unused',
                  payload: 'unused',
                  recordedRequests: calls,
                ),
              ),
            ),
          ],
        ),
      );

      await tester.pump();
      // No /attendance/session/start should fire when slotId is null.
      final startCalls =
          calls.where((c) => c['path'] == '/attendance/session/start').toList();
      expect(startCalls, isEmpty);
      expect(find.text('Demo subject'), findsOneWidget);
    },
  );
}
