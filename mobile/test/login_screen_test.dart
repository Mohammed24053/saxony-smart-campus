import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:saxony_smart_campus/features/auth/login_screen.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('renders the brand title + tagline + sign-in CTA', (
    tester,
  ) async {
    await tester.pumpWidget(
      bootstrap(
        const LoginScreen(),
        overrides: [fakeApiOverride(const {})],
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));

    // Brand chrome from AppStrings('auth.appName').
    expect(find.text('Smart Campus'), findsOneWidget);
    // Email field is pre-populated with the seeded super-admin email.
    expect(find.text('admin@saxony-egypt.edu'), findsOneWidget);
    // FilledButton submit CTA.
    expect(find.byType(FilledButton), findsWidgets);
  });

  testWidgets('localises to Arabic when MaterialApp.locale flips', (
    tester,
  ) async {
    await tester.pumpWidget(
      bootstrap(
        const LoginScreen(),
        locale: const Locale('ar'),
        overrides: [fakeApiOverride(const {})],
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('الحرم الذكي'), findsOneWidget);
  });
}
