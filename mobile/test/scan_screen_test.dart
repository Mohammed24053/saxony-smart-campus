import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:saxony_smart_campus/features/attendance/scan_screen.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('renders the scan title in the app bar', (tester) async {
    // MobileScanner uses platform channels that aren't available in widget
    // tests; we catch any platform exception so we still assert on the
    // chrome that should render regardless.
    FlutterError.onError = (details) {
      if (details.exception is MissingPluginException) return;
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(
      bootstrap(
        const ScanScreen(),
        overrides: [
          fakeAuthOverride(fakeAuthUser(role: 'student')),
          fakeApiOverride(const {}),
        ],
      ),
    );
    await tester.pump();

    expect(find.text('Scan attendance QR'), findsOneWidget);
  });
}
