import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand tokens for Saxony Egypt University.
///
/// Sourced from the official SEU logo. Use these constants — never hard-code
/// hex literals elsewhere in the app.
class SeuColors {
  SeuColors._();

  /// Top app bar, splash background, sidebar surface.
  static const navy = Color(0xFF31313B);

  /// Primary CTA, FAB, active tab, danger accents.
  static const red = Color(0xFFB1222A);

  /// Decorative highlight, badge, gold dot beneath active tab, splash particles.
  static const gold = Color(0xFFE4BD4F);

  /// Page background.
  static const cream = Color(0xFFF3EDE4);

  /// Subtext, inactive states, dividers.
  static const gray = Color(0xFF67666A);

  /// Card surface, inputs, app bar foreground icons.
  static const white = Color(0xFFFFFFFF);

  // Status colours — semantic, not branded.
  static const success = Color(0xFF2E7D32);
  static const warning = Color(0xFFE4BD4F);
  static const danger = Color(0xFFB1222A);
  static const info = Color(0xFF1976D2);

  static const navyOverlay8 = Color(0x14_31313B); // 8% over navy
  static const navyOverlay12 = Color(0x1F_31313B); // 12% over navy
  static const redTrack = Color(0x26_B1222A); // 15% red — progress track
}

/// Animation tokens — durations + curves used across the entire app.
///
/// Keep [m_]ed and [m_]q in sync with the web brand (Framer Motion durations
/// in `admin/src/lib/seu-theme.ts`) so motion feels consistent across surfaces.
class SeuMotion {
  SeuMotion._();

  // Durations
  static const fast = Duration(milliseconds: 150);
  static const med = Duration(milliseconds: 250);
  static const slow = Duration(milliseconds: 400);
  static const xslow = Duration(milliseconds: 800);
  static const counterUp = Duration(milliseconds: 1200);
  static const beam = Duration(milliseconds: 1500);

  // Curves
  static const enter = Curves.easeOutCubic;
  static const exit = Curves.easeInCubic;
  static const spring = Cubic(0.3, 1.4, 0.4, 1.0);
  static const bounce = Curves.elasticOut;
}

/// Border-radius tokens.
class SeuRadius {
  SeuRadius._();
  static const sm = 6.0;
  static const md = 10.0; // buttons, inputs
  static const lg = 16.0; // cards
  static const xl = 20.0; // modals, pills
  static final smR = BorderRadius.circular(sm);
  static final mdR = BorderRadius.circular(md);
  static final lgR = BorderRadius.circular(lg);
  static final xlR = BorderRadius.circular(xl);
}

/// Spacing scale — 4px increments.
class SeuSpacing {
  SeuSpacing._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

/// Builds the app's [ThemeData]. Honours the active [Locale] so Arabic locales
/// receive the Cairo typeface for proper RTL rendering.
class SeuTheme {
  SeuTheme._();

  static TextTheme _baseText(BuildContext context, Locale locale) {
    final isArabic = locale.languageCode == 'ar';
    final base = Theme.of(context).textTheme;
    if (isArabic) {
      return GoogleFonts.cairoTextTheme(base);
    }
    return GoogleFonts.poppinsTextTheme(base);
  }

  static ThemeData light(BuildContext context, Locale locale) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: SeuColors.red,
      primary: SeuColors.red,
      onPrimary: SeuColors.white,
      secondary: SeuColors.gold,
      onSecondary: SeuColors.navy,
      surface: SeuColors.white,
      onSurface: SeuColors.navy,
      background: SeuColors.cream,
      onBackground: SeuColors.navy,
      error: SeuColors.danger,
      onError: SeuColors.white,
      brightness: Brightness.light,
    );

    final text = _baseText(context, locale).apply(
      bodyColor: SeuColors.navy,
      displayColor: SeuColors.navy,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: SeuColors.cream,
      textTheme: text.copyWith(
        headlineLarge: text.headlineLarge?.copyWith(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
        ),
        headlineMedium: text.headlineMedium?.copyWith(
          fontSize: 22,
          fontWeight: FontWeight.w700,
        ),
        titleLarge: text.titleLarge?.copyWith(
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
        bodyLarge: text.bodyLarge?.copyWith(fontSize: 16),
        bodyMedium: text.bodyMedium?.copyWith(fontSize: 14),
        bodySmall: text.bodySmall?.copyWith(fontSize: 12, color: SeuColors.gray),
        labelLarge: text.labelLarge?.copyWith(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: SeuColors.navy,
        foregroundColor: SeuColors.white,
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: text.titleLarge?.copyWith(color: SeuColors.white),
        iconTheme: const IconThemeData(color: SeuColors.white),
      ),
      cardTheme: CardTheme(
        color: SeuColors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: SeuRadius.lgR,
          side: BorderSide(color: SeuColors.navy.withOpacity(0.06)),
        ),
        shadowColor: SeuColors.navy.withOpacity(0.06),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SeuColors.red,
          foregroundColor: SeuColors.white,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(borderRadius: SeuRadius.mdR),
          textStyle: text.labelLarge,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: SeuColors.red,
          foregroundColor: SeuColors.white,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(borderRadius: SeuRadius.mdR),
          textStyle: text.labelLarge,
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: SeuColors.navy,
          minimumSize: const Size(0, 48),
          side: const BorderSide(color: SeuColors.navy),
          shape: RoundedRectangleBorder(borderRadius: SeuRadius.mdR),
          textStyle: text.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: SeuColors.red,
          textStyle: text.labelLarge,
          minimumSize: const Size(0, 44),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SeuColors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: text.bodyMedium?.copyWith(color: SeuColors.gray),
        border: OutlineInputBorder(
          borderRadius: SeuRadius.mdR,
          borderSide: BorderSide(color: SeuColors.navy.withOpacity(0.16)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: SeuRadius.mdR,
          borderSide: BorderSide(color: SeuColors.navy.withOpacity(0.16)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: SeuRadius.mdR,
          borderSide: const BorderSide(color: SeuColors.red, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: SeuRadius.mdR,
          borderSide: const BorderSide(color: SeuColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: SeuRadius.mdR,
          borderSide: const BorderSide(color: SeuColors.danger, width: 1.6),
        ),
        labelStyle: text.bodyMedium?.copyWith(color: SeuColors.gray),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: SeuColors.navy.withOpacity(0.06),
        labelStyle: text.bodySmall?.copyWith(color: SeuColors.navy),
        side: BorderSide(color: SeuColors.navy.withOpacity(0.08)),
        shape: RoundedRectangleBorder(borderRadius: SeuRadius.xlR),
      ),
      dividerTheme: DividerThemeData(
        color: SeuColors.navy.withOpacity(0.08),
        thickness: 1,
        space: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: SeuColors.white,
        indicatorColor: Colors.transparent,
        labelTextStyle: WidgetStatePropertyAll(
          text.bodySmall?.copyWith(fontWeight: FontWeight.w600) ?? const TextStyle(),
        ),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: SeuColors.red, size: 26);
          }
          return const IconThemeData(color: SeuColors.gray, size: 24);
        }),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        height: 72,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: SeuColors.red,
        linearTrackColor: SeuColors.redTrack,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: SeuColors.navy,
        contentTextStyle: text.bodyMedium?.copyWith(color: SeuColors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: SeuRadius.mdR),
      ),
      dialogTheme: DialogTheme(
        backgroundColor: SeuColors.white,
        shape: RoundedRectangleBorder(borderRadius: SeuRadius.xlR),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: SeuColors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        modalElevation: 6,
      ),
    );
  }
}
