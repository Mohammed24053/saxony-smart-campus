import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Global locale state. Defaults to English; flip to `Locale('ar')` for Arabic
/// (RTL via `Directionality.of()` cascading from `MaterialApp.locale`).
class LocaleNotifier extends StateNotifier<Locale> {
  LocaleNotifier() : super(const Locale('en'));

  void toggle() {
    state = state.languageCode == 'en'
        ? const Locale('ar')
        : const Locale('en');
  }

  void set(Locale l) => state = l;
}

final localeProvider =
    StateNotifierProvider<LocaleNotifier, Locale>((_) => LocaleNotifier());
