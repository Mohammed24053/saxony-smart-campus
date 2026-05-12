import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:saxony_smart_campus/features/doctor/doctor_home_screen.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('renders today\'s lectures with a Start lecture button', (
    tester,
  ) async {
    await tester.pumpWidget(
      bootstrap(
        const DoctorHomeScreen(),
        overrides: [
          fakeAuthOverride(
            fakeAuthUser(name: 'Dr Hany', role: 'doctor'),
          ),
          fakeApiOverride({
            'GET /me/schedule/today': [
              {
                'id': 'slot-1',
                'subject': {'name': 'Operating Systems'},
                'section': {'name': 'CS-301-A'},
                'room': {'name': 'Hall B'},
                'startTime': '10:00',
                'endTime': '11:30',
              },
            ],
          }),
        ],
      ),
    );

    // FutureBuilder shows the loading indicator first.
    await tester.pump();
    // Resolve the queued Dio future.
    await tester.pumpAndSettle();

    expect(find.text("Today's lectures"), findsOneWidget);
    expect(find.text('Operating Systems'), findsOneWidget);
    expect(find.text('CS-301-A • Hall B'), findsOneWidget);
    expect(find.text('Start lecture'), findsOneWidget);
  });

  testWidgets(
      'tap Start lecture navigates to /doctor/active with the real slotId',
      (tester) async {
    Map<String, dynamic>? captured;

    final router = GoRouter(
      initialLocation: '/doctor',
      routes: [
        GoRoute(
          path: '/doctor',
          builder: (_, __) => const DoctorHomeScreen(),
        ),
        GoRoute(
          path: '/doctor/active',
          builder: (ctx, state) {
            captured = Map<String, dynamic>.from(
              state.extra as Map? ?? const <String, dynamic>{},
            );
            return const Scaffold(body: Text('active-captured'));
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fakeAuthOverride(
            fakeAuthUser(name: 'Dr Hany', role: 'doctor'),
          ),
          fakeApiOverride({
            'GET /me/schedule/today': [
              {
                'id': 'slot-zelda-1',
                'subject': {'name': 'Operating Systems'},
                'section': {'name': 'CS-301-A'},
                'room': {'name': 'Hall B'},
                'startTime': '10:00',
                'endTime': '11:30',
              },
            ],
          }),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          supportedLocales: const [Locale('en'), Locale('ar')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.text('Start lecture'));
    await tester.pumpAndSettle();

    expect(find.text('active-captured'), findsOneWidget);
    expect(captured, isNotNull);
    expect(
      captured!['slotId'],
      'slot-zelda-1',
      reason:
          'doctor home must hand the real ScheduleSlot.id to the active '
          'session screen so the backend POST /attendance/session/start '
          'binds to a real slot, not the demo ticker.',
    );
    expect(captured!['subject'], 'Operating Systems');
    expect(captured!['section'], 'CS-301-A');
    expect(captured!['room'], 'Hall B');
  });

  testWidgets('shows an empty tile when the schedule is empty', (
    tester,
  ) async {
    await tester.pumpWidget(
      bootstrap(
        const DoctorHomeScreen(),
        overrides: [
          fakeAuthOverride(fakeAuthUser(name: 'Dr Hany', role: 'doctor')),
          fakeApiOverride({'GET /me/schedule/today': <Map>[]}),
        ],
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No lectures today.'), findsOneWidget);
  });
}
