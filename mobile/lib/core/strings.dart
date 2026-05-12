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

  /// Sugar for keys that interpolate a named parameter, e.g. `{name}`.
  String fill(String key, Map<String, Object?> vars) {
    var s = t(key);
    vars.forEach((k, v) {
      s = s.replaceAll('{$k}', '${v ?? ''}');
    });
    return s;
  }
}

const Map<String, String> _en = {
  // Common
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
  'common.offline': 'Offline · showing cached data',
  'common.today': 'Today',
  'common.thisWeek': 'This week',
  'common.required': 'Required',
  'common.errorPrefix': 'Error: {message}',
  'common.live': 'LIVE',
  'common.todayLabel': 'TODAY',
  'common.failedToLoad': 'Failed to load: {message}',

  // Auth
  'auth.appName': 'Smart Campus',
  'auth.appTagline': 'Saxony Egypt University',
  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.email': 'Email',
  'auth.emailOrStudentId': 'Email or Student ID',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot password?',
  'auth.forgotPasswordHint':
      "Enter your email — we'll send a reset link if your account exists.",
  'auth.forgotPasswordSent':
      'If an account exists, a reset email has been sent.',
  'auth.twoFactor': 'Two-factor code',
  'auth.verifyCode': 'Verify code',
  'auth.biometric': 'Sign in with biometrics',
  'auth.biometricComingSoon': 'Biometric sign-in coming soon',
  'auth.otpHint': 'Enter the 6-digit code from your authenticator app',
  'auth.role.student': 'Student',
  'auth.role.doctor': 'Doctor',
  'auth.invalid': 'Login failed',

  // Navigation
  'nav.home': 'Home',
  'nav.schedule': 'Schedule',
  'nav.scan': 'Scan',
  'nav.history': 'History',
  'nav.inbox': 'Inbox',
  'nav.profile': 'Profile',

  // Student home
  'home.greeting': 'Good morning,',
  'home.goodMorning': 'Good morning',
  'home.goodAfternoon': 'Good afternoon',
  'home.goodEvening': 'Good evening',
  'home.studentFallback': 'Student',
  'home.next': 'Next lecture',
  'home.nextLectureLabel': 'NEXT LECTURE',
  'home.now': 'Now',
  'home.upcoming': 'Upcoming',
  'home.inProgress': 'In progress',
  'home.todayEmpty': 'No lectures today.',
  'home.allCaughtUp': 'No more lectures today',
  'home.todayLectures': "Today's lectures",
  'home.noToday': 'No lectures scheduled for today.',

  // Schedule
  'schedule.title': 'My Schedule',
  'schedule.empty': 'No lectures this week.',
  'schedule.emptyDay': 'No lectures on {day}.',
  'schedule.day.sun': 'Sun',
  'schedule.day.mon': 'Mon',
  'schedule.day.tue': 'Tue',
  'schedule.day.wed': 'Wed',
  'schedule.day.thu': 'Thu',
  'schedule.day.fri': 'Fri',
  'schedule.day.sat': 'Sat',

  // Scan
  'scan.title': 'Scan attendance QR',
  'scan.point': 'Point at the QR code on the projector',
  'scan.success': 'Attendance recorded!',
  'scan.recordedFor': 'Attendance recorded for {status}',
  'scan.tryAgain': 'Try again',
  'scan.expired': 'QR expired — ask the doctor',
  'scan.expiredShort': 'QR expired',
  'scan.outOfRange': 'You are outside the room',
  'scan.outOfRangeShort': 'Out of range',
  'scan.alreadyRegistered': 'Already registered',
  'scan.failed': 'Scan failed',

  // History (attendance)
  'history.title': 'Attendance history',
  'history.empty': 'No attendance records yet.',
  'history.subjectAvg': 'Subject attendance',
  'history.lectureCount': '{count} lectures',
  'history.approachingThreshold': 'Approaching threshold',

  // Notifications
  'notifications.title': 'Notifications',
  'notifications.markAllRead': 'Mark all read',
  'notifications.empty': 'No notifications.',
  'notifications.allCaughtUp': "You're all caught up",
  'notifications.newWillAppear': 'New notifications will appear here.',
  'notifications.noTitle': '(no title)',

  // Profile
  'profile.title': 'Profile',
  'profile.personalInfo': 'Personal info',
  'profile.security': 'Security',
  'profile.preferences': 'Preferences',
  'profile.account': 'Account',
  'profile.language': 'Language',
  'profile.notifications': 'Notifications',
  'profile.notificationsHint': 'Manage push, email, and in-app alerts',
  'profile.changePassword': 'Change password',
  'profile.changePasswordError': 'Could not change password',
  'profile.currentPassword': 'Current password',
  'profile.newPassword': 'New password',
  'profile.passwordMin': 'Min 8 characters',
  'profile.biometricEnabled': 'Biometric sign-in',
  'profile.biometricHint': 'Use Face ID / fingerprint to sign in',
  'profile.logoutAll': 'Log out all devices',
  'profile.logoutAllHint': 'Sign out from every browser and phone',
  'profile.logoutAllConfirm': 'Log out all devices?',
  'profile.logoutAllConfirmBody':
      "This will sign you out from every browser and phone. You'll need to sign in again.",
  'profile.logoutEverywhere': 'Log out everywhere',
  'profile.helpSupport': 'Help & support',

  // Doctor
  'doctor.todayTitle': "Today's lectures",
  'doctor.startLecture': 'Start lecture',
  'doctor.endLecture': 'End lecture',
  'doctor.activeTitle': 'Active session',
  'doctor.scansSoFar': '{count} scans so far',
  'doctor.pause': 'Pause',
  'doctor.currentlyPresent': 'Currently present',
  'doctor.tabPresent': 'Present ({count})',
  'doctor.tabAbsent': 'Absent ({count})',
  'doctor.noScansYet': 'No scans yet',
  'doctor.empty': 'Empty',
  'doctor.activeLectureFallback': 'Active lecture',
  'doctor.sectionFallback': 'Section',
  'doctor.roomFallback': 'Room',
  'doctor.welcome': 'Welcome,',
  'doctor.welcomeFallback': 'Doctor',
  'doctor.lectureStartsIn': 'STARTS IN',
  'doctor.scanPrompt': 'Have students scan the QR before it rotates.',
  'doctor.rotatesIn': 'Rotates in {seconds}s',
  'doctor.expectedLabel': 'Expected',
  'doctor.backToToday': "Back to today's lectures",
  'doctor.todayLabel': 'TODAY',

  // Attendance status (chips)
  'attendance.present': 'Present',
  'attendance.late': 'Late',
  'attendance.absent': 'Absent',
  'attendance.warning1': 'Warning 1',
  'attendance.warning2': 'Warning 2',
  'attendance.deprivation': 'Deprivation',
};

const Map<String, String> _ar = {
  // Common
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
  'common.offline': 'غير متصل · يتم عرض البيانات المخزنة',
  'common.today': 'اليوم',
  'common.thisWeek': 'هذا الأسبوع',
  'common.required': 'مطلوب',
  'common.errorPrefix': 'خطأ: {message}',
  'common.live': 'مباشر',
  'common.todayLabel': 'اليوم',
  'common.failedToLoad': 'تعذّر التحميل: {message}',

  // Auth
  'auth.appName': 'الحرم الذكي',
  'auth.appTagline': 'جامعة ساكسوني مصر',
  'auth.signIn': 'تسجيل الدخول',
  'auth.signOut': 'تسجيل الخروج',
  'auth.email': 'البريد الإلكتروني',
  'auth.emailOrStudentId': 'البريد الإلكتروني أو الرقم الجامعي',
  'auth.password': 'كلمة المرور',
  'auth.forgotPassword': 'هل نسيت كلمة المرور؟',
  'auth.forgotPasswordHint':
      'أدخل بريدك الإلكتروني — وسنرسل رابط إعادة تعيين إذا كان حسابك موجوداً.',
  'auth.forgotPasswordSent':
      'إذا كان الحساب موجوداً، فقد تم إرسال بريد إعادة التعيين.',
  'auth.twoFactor': 'رمز التحقق المكون من خطوتين',
  'auth.verifyCode': 'تأكيد الرمز',
  'auth.biometric': 'تسجيل الدخول بالبصمة',
  'auth.biometricComingSoon': 'تسجيل الدخول بالبصمة قريباً',
  'auth.otpHint': 'أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة',
  'auth.role.student': 'طالب',
  'auth.role.doctor': 'دكتور',
  'auth.invalid': 'فشل تسجيل الدخول',

  // Navigation
  'nav.home': 'الرئيسية',
  'nav.schedule': 'الجدول',
  'nav.scan': 'مسح',
  'nav.history': 'السجل',
  'nav.inbox': 'الإشعارات',
  'nav.profile': 'حسابي',

  // Student home
  'home.greeting': 'صباح الخير،',
  'home.goodMorning': 'صباح الخير',
  'home.goodAfternoon': 'مساء الخير',
  'home.goodEvening': 'مساء الخير',
  'home.studentFallback': 'طالب',
  'home.next': 'المحاضرة القادمة',
  'home.nextLectureLabel': 'المحاضرة القادمة',
  'home.now': 'الآن',
  'home.upcoming': 'القادمة',
  'home.inProgress': 'قيد التشغيل',
  'home.todayEmpty': 'لا توجد محاضرات اليوم.',
  'home.allCaughtUp': 'لا مزيد من المحاضرات اليوم',
  'home.todayLectures': 'محاضرات اليوم',
  'home.noToday': 'لا توجد محاضرات مجدولة لليوم.',

  // Schedule
  'schedule.title': 'جدولي الدراسي',
  'schedule.empty': 'لا توجد محاضرات هذا الأسبوع.',
  'schedule.emptyDay': 'لا توجد محاضرات يوم {day}.',
  'schedule.day.sun': 'الأحد',
  'schedule.day.mon': 'الإثنين',
  'schedule.day.tue': 'الثلاثاء',
  'schedule.day.wed': 'الأربعاء',
  'schedule.day.thu': 'الخميس',
  'schedule.day.fri': 'الجمعة',
  'schedule.day.sat': 'السبت',

  // Scan
  'scan.title': 'مسح رمز الحضور',
  'scan.point': 'وجّه الكاميرا نحو رمز QR على البروجكتور',
  'scan.success': 'تم تسجيل الحضور!',
  'scan.recordedFor': 'تم تسجيل الحضور كـ {status}',
  'scan.tryAgain': 'حاول مرة أخرى',
  'scan.expired': 'انتهت صلاحية الرمز — اطلب من الدكتور',
  'scan.expiredShort': 'انتهت صلاحية الرمز',
  'scan.outOfRange': 'أنت خارج القاعة',
  'scan.outOfRangeShort': 'خارج النطاق',
  'scan.alreadyRegistered': 'تم التسجيل مسبقاً',
  'scan.failed': 'فشل المسح',

  // History (attendance)
  'history.title': 'سجل الحضور',
  'history.empty': 'لا توجد سجلات حضور بعد.',
  'history.subjectAvg': 'حضور المواد',
  'history.lectureCount': '{count} محاضرة',
  'history.approachingThreshold': 'الاقتراب من حد الإنذار',

  // Notifications
  'notifications.title': 'الإشعارات',
  'notifications.markAllRead': 'تعليم الكل كمقروء',
  'notifications.empty': 'لا توجد إشعارات.',
  'notifications.allCaughtUp': 'تم الاطلاع على كل شيء',
  'notifications.newWillAppear': 'ستظهر الإشعارات الجديدة هنا.',
  'notifications.noTitle': '(بدون عنوان)',

  // Profile
  'profile.title': 'الملف الشخصي',
  'profile.personalInfo': 'المعلومات الشخصية',
  'profile.security': 'الأمان',
  'profile.preferences': 'التفضيلات',
  'profile.account': 'الحساب',
  'profile.language': 'اللغة',
  'profile.notifications': 'الإشعارات',
  'profile.notificationsHint':
      'إدارة الإشعارات الفورية والبريد والتنبيهات داخل التطبيق',
  'profile.changePassword': 'تغيير كلمة المرور',
  'profile.changePasswordError': 'تعذّر تغيير كلمة المرور',
  'profile.currentPassword': 'كلمة المرور الحالية',
  'profile.newPassword': 'كلمة المرور الجديدة',
  'profile.passwordMin': 'حد أدنى 8 أحرف',
  'profile.biometricEnabled': 'الدخول بالبصمة',
  'profile.biometricHint': 'استخدم Face ID أو البصمة لتسجيل الدخول',
  'profile.logoutAll': 'تسجيل الخروج من كل الأجهزة',
  'profile.logoutAllHint': 'سجّل خروجك من كل المتصفحات والهواتف',
  'profile.logoutAllConfirm': 'تسجيل الخروج من كل الأجهزة؟',
  'profile.logoutAllConfirmBody':
      'سيتم تسجيل خروجك من كل المتصفحات والهواتف. ستحتاج إلى تسجيل الدخول مرة أخرى.',
  'profile.logoutEverywhere': 'تسجيل الخروج من كل مكان',
  'profile.helpSupport': 'المساعدة والدعم',

  // Doctor
  'doctor.todayTitle': 'محاضرات اليوم',
  'doctor.startLecture': 'بدء المحاضرة',
  'doctor.endLecture': 'إنهاء المحاضرة',
  'doctor.activeTitle': 'جلسة نشطة',
  'doctor.scansSoFar': '{count} مسح حتى الآن',
  'doctor.pause': 'إيقاف مؤقت',
  'doctor.currentlyPresent': 'الحاضرون الآن',
  'doctor.tabPresent': 'حاضر ({count})',
  'doctor.tabAbsent': 'غائب ({count})',
  'doctor.noScansYet': 'لا توجد عمليات مسح بعد',
  'doctor.empty': 'فارغ',
  'doctor.activeLectureFallback': 'محاضرة نشطة',
  'doctor.sectionFallback': 'الشعبة',
  'doctor.roomFallback': 'القاعة',
  'doctor.welcome': 'أهلاً،',
  'doctor.welcomeFallback': 'دكتور',
  'doctor.lectureStartsIn': 'تبدأ بعد',
  'doctor.scanPrompt': 'اطلب من الطلاب مسح الرمز قبل تحديثه.',
  'doctor.rotatesIn': 'يتجدد خلال {seconds} ث',
  'doctor.expectedLabel': 'المتوقع',
  'doctor.backToToday': 'العودة لمحاضرات اليوم',
  'doctor.todayLabel': 'اليوم',

  // Attendance status (chips)
  'attendance.present': 'حاضر',
  'attendance.late': 'متأخر',
  'attendance.absent': 'غائب',
  'attendance.warning1': 'إنذار 1',
  'attendance.warning2': 'إنذار 2',
  'attendance.deprivation': 'حرمان',
};
