import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:saxony_smart_campus/features/profile/profile_screen.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('renders the profile heading + user name when signed in', (
    tester,
  ) async {
    await tester.pumpWidget(
      bootstrap(
        const ProfileScreen(),
        overrides: [
          fakeAuthOverride(
            fakeAuthUser(name: 'Mohammed Ali', role: 'student'),
          ),
          fakeApiOverride(const {}),
        ],
      ),
    );
    await tester.pump();

    // English locale title.
    expect(find.text('Profile'), findsOneWidget);
    // The logged-in user name is rendered in the avatar header.
    expect(find.text('Mohammed Ali'), findsOneWidget);
  });

  testWidgets('flips to RTL when the locale is Arabic', (tester) async {
    await tester.pumpWidget(
      bootstrap(
        const ProfileScreen(),
        locale: const Locale('ar'),
        overrides: [
          fakeAuthOverride(fakeAuthUser(name: 'محمد علي', role: 'student')),
          fakeApiOverride(const {}),
        ],
      ),
    );
    await tester.pump();

    expect(find.text('الملف الشخصي'), findsOneWidget);
    expect(find.text('محمد علي'), findsOneWidget);
  });
}
