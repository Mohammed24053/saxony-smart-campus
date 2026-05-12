import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';

/// Splash screen.
///
/// Animation sequence (~2s total):
///  1. Backdrop fades in (200ms).
///  2. SEU shield logo scales 0.5 → 1.0 with elastic spring (700ms).
///  3. Gold particles burst radially (800ms, ease-out-cubic).
///  4. "Smart Campus" wordmark fades in below (250ms, 400ms after logo).
///  5. After ~1700ms total, route transitions to /login (or /home if signed in).
///
/// This is a Flutter-only equivalent of the Rive splash described in the
/// design brief — once a `.riv` file is provided, swap the `_LogoSquare`
/// widget for a `RiveAnimation.asset()` and keep the rest as-is.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key, this.next = '/login'});

  final String next;

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  bool _routed = false;

  @override
  void initState() {
    super.initState();
    // Navigate when BOTH (a) the splash animation has played for at least
    // 1.8s and (b) the auth bootstrap ("is there a valid session in
    // secure storage?") has completed. Whichever finishes second triggers
    // the route. This fixes the "every cold boot lands on /login" bug.
    Future.delayed(const Duration(milliseconds: 1800), _maybeRoute);
  }

  void _maybeRoute() {
    if (!mounted || _routed) return;
    final booting = ref.read(authBootingProvider);
    if (booting) return; // wait for /me to finish; listener below retries
    _routed = true;
    final user = ref.read(authProvider);
    final dest = user == null
        ? widget.next
        : (user.role == 'doctor' ? '/doctor/today' : '/home');
    context.go(dest);
  }

  @override
  Widget build(BuildContext context) {
    // When auth bootstrap completes, try to route (if the 1.8s animation has
    // also already elapsed). Otherwise the post-frame Future.delayed callback
    // in initState will route once it fires.
    ref.listen<bool>(authBootingProvider, (_, booting) {
      if (!booting) _maybeRoute();
    });
    return Scaffold(
      backgroundColor: SeuColors.navy,
      body: Stack(
        alignment: Alignment.center,
        children: [
          // Slow drifting background gradient pattern.
          Animate(
            effects: const [FadeEffect(duration: Duration(milliseconds: 400))],
            child: const _SplashBackdrop(),
          ),

          // Gold particle burst.
          Positioned.fill(
            child: Animate(
              effects: const [
                FadeEffect(
                  begin: 0,
                  end: 1,
                  delay: Duration(milliseconds: 200),
                  duration: Duration(milliseconds: 200),
                ),
              ],
              child: const _ParticleBurst(),
            ),
          ),

          // Logo + wordmark stack.
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _LogoSquare()
                  .animate()
                  .scale(
                    begin: const Offset(0.55, 0.55),
                    end: const Offset(1.0, 1.0),
                    duration: const Duration(milliseconds: 700),
                    curve: SeuMotion.bounce,
                  )
                  .fade(duration: const Duration(milliseconds: 300)),
              const SizedBox(height: 24),
              Text(
                AppStrings.of(context).t('auth.appName'),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: SeuColors.white,
                      fontWeight: FontWeight.w700,
                    ),
              )
                  .animate()
                  .fadeIn(
                    delay: const Duration(milliseconds: 550),
                    duration: const Duration(milliseconds: 350),
                  )
                  .slideY(
                    begin: 0.4,
                    end: 0,
                    delay: const Duration(milliseconds: 550),
                    duration: const Duration(milliseconds: 400),
                    curve: SeuMotion.enter,
                  ),
              const SizedBox(height: 4),
              Text(
                AppStrings.of(context).t('auth.appTagline'),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: SeuColors.gold,
                      letterSpacing: 0.6,
                    ),
              )
                  .animate()
                  .fadeIn(
                    delay: const Duration(milliseconds: 750),
                    duration: const Duration(milliseconds: 350),
                  ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SplashBackdrop extends StatelessWidget {
  const _SplashBackdrop();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment.center,
          radius: 0.9,
          colors: [Color(0xFF3A3A48), SeuColors.navy],
        ),
      ),
    );
  }
}

/// SEU shield placeholder (will be swapped for the official .riv when supplied).
///
/// Renders a 96x96 square with a gold-bordered red center bearing the
/// "SE" wordmark — visually consistent with the web admin's logo badge.
class _LogoSquare extends StatelessWidget {
  const _LogoSquare();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 112,
      height: 112,
      decoration: BoxDecoration(
        color: SeuColors.red,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: SeuColors.gold, width: 3),
        boxShadow: [
          BoxShadow(
            color: SeuColors.gold.withOpacity(0.35),
            blurRadius: 40,
            spreadRadius: 4,
          ),
        ],
      ),
      child: Center(
        child: Text(
          'SE',
          style: TextStyle(
            color: SeuColors.white,
            fontSize: 44,
            fontWeight: FontWeight.w900,
            letterSpacing: -1,
            fontFamily: Theme.of(context).textTheme.headlineLarge?.fontFamily,
          ),
        ),
      ),
    );
  }
}

class _ParticleBurst extends StatefulWidget {
  const _ParticleBurst();

  @override
  State<_ParticleBurst> createState() => _ParticleBurstState();
}

class _ParticleBurstState extends State<_ParticleBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    final rng = math.Random(42);
    _particles = List.generate(28, (i) {
      final angle = (i / 28) * math.pi * 2 + rng.nextDouble() * 0.4;
      return _Particle(
        angle: angle,
        distance: 90 + rng.nextDouble() * 130,
        size: 3.0 + rng.nextDouble() * 4.0,
      );
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => CustomPaint(
        painter: _ParticlePainter(_particles, _ctrl.value),
      ),
    );
  }
}

class _Particle {
  _Particle({required this.angle, required this.distance, required this.size});
  final double angle;
  final double distance;
  final double size;
}

class _ParticlePainter extends CustomPainter {
  _ParticlePainter(this.particles, this.t);

  final List<_Particle> particles;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final eased = Curves.easeOutCubic.transform(t.clamp(0.0, 1.0));
    final fade = (1 - t).clamp(0.0, 1.0);
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in particles) {
      final r = p.distance * eased;
      final dx = math.cos(p.angle) * r;
      final dy = math.sin(p.angle) * r;
      paint.color = SeuColors.gold.withOpacity(fade * 0.95);
      canvas.drawCircle(center + Offset(dx, dy), p.size * (1 - eased * 0.4), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ParticlePainter old) =>
      old.t != t || old.particles != particles;
}
