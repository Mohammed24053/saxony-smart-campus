import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
