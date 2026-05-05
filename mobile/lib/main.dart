import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/auth_state.dart';
import 'core/locale_provider.dart';
import 'core/notifications.dart';
import 'features/attendance/history_screen.dart';
import 'features/attendance/scan_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/splash_screen.dart';
import 'features/doctor/active_session_screen.dart';
import 'features/doctor/doctor_home_screen.dart';
import 'features/auth/forgot_password_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/schedule/schedule_screen.dart';
import 'features/student/home_screen.dart';
import 'theme/app_theme.dart';
import 'widgets/seu/seu_bottom_nav.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: SmartCampusApp()));
}

final _routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final user = ref.read(authProvider);
      final loggedIn = user != null;
      final loc = state.matchedLocation;
      if (loc == '/' || loc == '/splash') return null;
      final isPublic = loc == '/login' || loc == '/forgot-password';
      if (!loggedIn && !isPublic) return '/login';
      if (loggedIn && isPublic) {
        return user.role == 'doctor' ? '/doctor/today' : '/home';
      }
      return null;
    },
    refreshListenable: GoRouterRefreshStream(ref),
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen(next: '/login')),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/doctor/today', builder: (_, __) => const DoctorHomeScreen()),
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const StudentHomeScreen()),
          GoRoute(path: '/schedule', builder: (_, __) => const ScheduleScreen()),
          GoRoute(path: '/scan', builder: (_, __) => const ScanScreen()),
          GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
          GoRoute(
            path: '/notifications',
            builder: (_, __) => const NotificationsScreen(),
          ),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ],
      ),
      GoRoute(
        path: '/doctor/active',
        builder: (_, state) {
          final args = (state.extra ?? const {}) as Map;
          return ActiveSessionScreen(
            subject: args['subject'] as String? ?? 'Active lecture',
            section: args['section'] as String? ?? 'Section',
            room: args['room'] as String? ?? 'Room',
          );
        },
      ),
    ],
  );
});

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

class SmartCampusApp extends ConsumerWidget {
  const SmartCampusApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(_routerProvider);
    final locale = ref.watch(localeProvider);
    return MaterialApp.router(
      title: 'Saxony Smart Campus',
      debugShowCheckedModeBanner: false,
      theme: SeuTheme.light(context, locale),
      routerConfig: router,
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
    );
  }
}

class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.child});
  final Widget child;

  static const _routes = [
    '/home',
    '/schedule',
    '/scan',
    '/history',
    '/notifications',
    '/profile',
  ];

  static const _items = [
    SeuNavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
    SeuNavItem(
      icon: Icons.calendar_today_outlined,
      activeIcon: Icons.calendar_today,
      label: 'Schedule',
    ),
    SeuNavItem(
      icon: Icons.qr_code_scanner_outlined,
      activeIcon: Icons.qr_code_scanner,
      label: 'Scan',
    ),
    SeuNavItem(
      icon: Icons.bar_chart_outlined,
      activeIcon: Icons.bar_chart,
      label: 'History',
    ),
    SeuNavItem(
      icon: Icons.notifications_outlined,
      activeIcon: Icons.notifications,
      label: 'Inbox',
    ),
    SeuNavItem(
      icon: Icons.person_outline,
      activeIcon: Icons.person,
      label: 'Profile',
    ),
  ];

  int _indexFor(String path) {
    final idx = _routes.indexWhere((r) => path.startsWith(r));
    return idx == -1 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loc = GoRouterState.of(context).matchedLocation;
    return Scaffold(
      body: child,
      bottomNavigationBar: SeuBottomNav(
        items: _items,
        selectedIndex: _indexFor(loc),
        onSelected: (i) => context.go(_routes[i]),
      ),
    );
  }
}
