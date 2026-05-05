import 'package:flutter/material.dart';

/// Lightweight in-app i18n (no `intl_translation` codegen).
///
/// Mirrors the admin web's `useT()` hook: a flat key/value lookup with a
/// fallback chain (current locale → English → key). The active locale is
/// driven by `LocaleNotifier`; widgets read the strings through the
/// `AppStrings.of(context)` helper which uses `Localizations.localeOf()`
/// so it stays in sync with `MaterialApp.locale`.
class AppStrings {
  final Locale locale;
  final Map<String, String> _dict;

  AppStrings._(this.locale, this._dict);

  /// Resolve once per locale change. Falls back to English if a key is
  /// missing in the Arabic dictionary so partial translations don't crash.
  factory AppStrings.fromLocale(Locale l) {
    final base = _en;
    final dict = l.languageCode == 'ar' ? {...base, ..._ar} : base;
    return AppStrings._(l, dict);
  }

  static AppStrings of(BuildContext context) =>
      AppStrings.fromLocale(Localizations.localeOf(context));

  bool get isRtl => locale.languageCode == 'ar';

  String t(String key) => _dict[key] ?? _en[key] ?? key;

  /// Sugar for keys that interpolate a single integer.
  String count(String key, int n) => t(key).replaceAll('{count}', '$n');
}

const Map<String, String> _en = {
  'common.search': 'Search',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.retry': 'Retry',
  'common.loading': 'Loading…',
  'common.empty': 'Nothing here yet.',
  'common.offline': 'You are offline — showing cached data',
  'common.today': 'Today',
  'common.thisWeek': 'This week',
  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot password?',
  'auth.twoFactor': 'Two-factor code',
  'auth.verifyCode': 'Verify code',
  'auth.biometric': 'Sign in with biometrics',
  'auth.role.student': 'Student',
  'auth.role.doctor': 'Doctor',
  'auth.invalid': 'Login failed',
  'home.greeting': 'Good morning,',
  'home.next': 'Next lecture',
  'home.now': 'Now',
  'home.upcoming': 'Upcoming',
  'home.todayEmpty': 'No lectures today.',
  'schedule.title': 'Schedule',
  'schedule.empty': 'No lectures this week.',
  'scan.title': 'Scan QR',
  'scan.point': 'Point at the QR code',
  'scan.success': 'Attendance recorded!',
  'scan.expired': 'QR expired — ask the doctor',
  'scan.outOfRange': 'You are outside the room',
  'scan.alreadyRegistered': 'Already registered',
  'history.title': 'Attendance',
  'history.subjectAvg': 'Subject attendance',
  'notifications.title': 'Notifications',
  'notifications.markAllRead': 'Mark all read',
  'notifications.empty': 'No notifications.',
  'profile.title': 'Profile',
  'profile.personalInfo': 'Personal info',
  'profile.security': 'Security',
  'profile.changePassword': 'Change password',
  'profile.currentPassword': 'Current password',
  'profile.newPassword': 'New password',
  'profile.biometricEnabled': 'Sign in with biometrics',
  'profile.logoutAll': 'Log out all devices',
  'doctor.todayTitle': 'Today\'s lectures',
  'doctor.startLecture': 'Start lecture',
  'doctor.endLecture': 'End lecture',
  'doctor.activeTitle': 'Active session',
  'doctor.scansSoFar': '{count} scans so far',
};

const Map<String, String> _ar = {
  'common.search': 'بحث',
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.delete': 'حذف',
  'common.edit': 'تعديل',
  'common.back': 'رجوع',
  'common.next': 'التالي',
  'common.retry': 'إعادة المحاولة',
  'common.loading': 'جارٍ التحميل…',
  'common.empty': 'لا يوجد شيء بعد.',
  'common.offline': 'أنت غير متصل — يتم عرض البيانات المخزنة',
  'common.today': 'اليوم',
  'common.thisWeek': 'هذا الأسبوع',
  'auth.signIn': 'تسجيل الدخول',
  'auth.signOut': 'تسجيل الخروج',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.forgotPassword': 'هل نسيت كلمة المرور؟',
  'auth.twoFactor': 'رمز التحقق المكون من خطوتين',
  'auth.verifyCode': 'تأكيد الرمز',
  'auth.biometric': 'تسجيل الدخول بالبصمة',
  'auth.role.student': 'طالب',
  'auth.role.doctor': 'دكتور',
  'auth.invalid': 'فشل تسجيل الدخول',
  'home.greeting': 'صباح الخير،',
  'home.next': 'المحاضرة القادمة',
  'home.now': 'الآن',
  'home.upcoming': 'القادمة',
  'home.todayEmpty': 'لا توجد محاضرات اليوم.',
  'schedule.title': 'الجدول الدراسي',
  'schedule.empty': 'لا توجد محاضرات هذا الأسبوع.',
  'scan.title': 'مسح رمز QR',
  'scan.point': 'وجه الكاميرا نحو رمز QR',
  'scan.success': 'تم تسجيل الحضور!',
  'scan.expired': 'انتهت صلاحية الرمز — اطلب من الدكتور',
  'scan.outOfRange': 'أنت خارج القاعة',
  'scan.alreadyRegistered': 'تم التسجيل مسبقًا',
  'history.title': 'الحضور',
  'history.subjectAvg': 'حضور المواد',
  'notifications.title': 'الإشعارات',
  'notifications.markAllRead': 'وضع علامة كمقروء على الكل',
  'notifications.empty': 'لا توجد إشعارات.',
  'profile.title': 'الملف الشخصي',
  'profile.personalInfo': 'معلومات شخصية',
  'profile.security': 'الأمان',
  'profile.changePassword': 'تغيير كلمة المرور',
  'profile.currentPassword': 'كلمة المرور الحالية',
  'profile.newPassword': 'كلمة المرور الجديدة',
  'profile.biometricEnabled': 'تسجيل الدخول بالبصمة',
  'profile.logoutAll': 'تسجيل الخروج من كل الأجهزة',
  'doctor.todayTitle': 'محاضرات اليوم',
  'doctor.startLecture': 'بدء المحاضرة',
  'doctor.endLecture': 'إنهاء المحاضرة',
  'doctor.activeTitle': 'جلسة نشطة',
  'doctor.scansSoFar': '{count} مسح حتى الآن',
};
