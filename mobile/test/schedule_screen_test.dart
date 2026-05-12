import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:saxony_smart_campus/features/schedule/schedule_screen.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('renders the day-picker chrome', (tester) async {
    await tester.pumpWidget(
      bootstrap(
        const ScheduleScreen(),
        overrides: [
          fakeAuthOverride(fakeAuthUser(role: 'student')),
          fakeApiOverride({
            'GET /schedule/my': [
              {
                'id': 'slot-1',
                'dayOfWeek': DateTime.now().weekday % 7,
                'subject': {'name': 'Linear Algebra'},
                'room': {'name': 'Lab A'},
                'startTime': '09:00',
                'endTime': '10:30',
              },
            ],
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    // Day labels render — at least the abbreviation for one day must show.
    expect(find.textContaining(RegExp('Sun|Mon|Tue|Wed|Thu|Fri|Sat')), findsWidgets);
  });
}
