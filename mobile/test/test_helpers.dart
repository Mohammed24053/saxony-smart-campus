import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:saxony_smart_campus/core/api_client.dart';
import 'package:saxony_smart_campus/core/auth_state.dart';

/// Builds a [Dio] whose interceptors resolve every request from the given
/// [routes] map. Allows widget tests to run fully offline.
///
/// Keys are `"METHOD /path"`, values are the JSON body returned wrapped
/// in `{"data": ...}` to match the backend envelope.
Dio fakeDio(Map<String, Object?> routes) {
  final dio = Dio();
  dio.interceptors.clear();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final key = '${options.method.toUpperCase()} ${options.path}';
        if (!routes.containsKey(key)) {
          return handler.reject(
            DioException(
              requestOptions: options,
              response: Response(
                requestOptions: options,
                statusCode: 404,
                data: {
                  'error': {'code': 'NOT_FOUND', 'message': 'no test route for $key'},
                },
              ),
              type: DioExceptionType.badResponse,
            ),
          );
        }
        final body = routes[key];
        handler.resolve(
          Response(
            requestOptions: options,
            statusCode: 200,
            data: {'data': body},
          ),
        );
      },
    ),
  );
  return dio;
}

/// Wrap any screen in the standard MaterialApp + ProviderScope chrome that
/// the production `main.dart` provides. [overrides] lets tests inject
/// fake auth + api state.
Widget bootstrap(
  Widget child, {
  List<Override> overrides = const [],
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: child,
    ),
  );
}

AuthUser fakeAuthUser({
  String id = 'u1',
  String name = 'Test User',
  String role = 'student',
  String email = 'test@example.com',
  String universityId = 'uni1',
}) =>
    AuthUser(
      id: id,
      email: email,
      name: name,
      role: role,
      universityId: universityId,
    );

/// Pre-built [authProvider] override that plants a logged-in user
/// without going through the cold-boot `/me` rehydration.
Override fakeAuthOverride(AuthUser user) {
  return authProvider.overrideWith((ref) {
    ref.read(authBootingProvider.notifier).state = false;
    final n = _StubAuthNotifier(ref);
    n._set(user);
    return n;
  });
}

/// Override the [apiProvider] with a Dio whose routes are pre-stubbed.
Override fakeApiOverride(Map<String, Object?> routes) {
  return apiProvider.overrideWith((_) => ApiClient.fromDio(fakeDio(routes)));
}

class _StubAuthNotifier extends AuthNotifier {
  _StubAuthNotifier(Ref ref) : super(ref);

  void _set(AuthUser user) {
    state = user;
  }
}
