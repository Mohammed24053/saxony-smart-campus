import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_state.dart';
import '../../core/locale_provider.dart';
import '../../theme/app_theme.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider);
    final locale = ref.watch(localeProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [SeuColors.navy, Color(0xFF1F1F26)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(SeuRadius.xl),
              boxShadow: SeuShadow.tileLift,
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: SeuColors.gold,
                  child: Text(
                    (user?.name ?? '—')
                        .split(' ')
                        .take(2)
                        .map((p) => p.isEmpty ? '' : p[0])
                        .join(),
                    style: const TextStyle(
                      color: SeuColors.navy,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? '—',
                        style: const TextStyle(
                          color: SeuColors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(color: SeuColors.cream, fontSize: 13),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: SeuColors.gold,
                          borderRadius: SeuRadius.xlR,
                        ),
                        child: Text(
                          (user?.role ?? '').toUpperCase(),
                          style: const TextStyle(
                            color: SeuColors.navy,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionLabel('Preferences'),
          _SettingsTile(
            leading: Icons.translate,
            title: 'Language',
            subtitle: locale.languageCode == 'ar' ? 'العربية' : 'English',
            onTap: () => ref.read(localeProvider.notifier).toggle(),
          ),
          _SettingsTile(
            leading: Icons.notifications_outlined,
            title: 'Notifications',
            subtitle: 'Manage push, email, and in-app alerts',
            onTap: () {},
          ),
          _SettingsTile(
            leading: Icons.fingerprint,
            title: 'Biometric sign-in',
            subtitle: 'Use Face ID / fingerprint to sign in',
            onTap: () {},
          ),
          const SizedBox(height: 16),
          _SectionLabel('Account'),
          _SettingsTile(
            leading: Icons.lock_outline,
            title: 'Change password',
            onTap: () {},
          ),
          _SettingsTile(
            leading: Icons.help_outline,
            title: 'Help & support',
            onTap: () {},
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.logout, color: SeuColors.danger),
            style: OutlinedButton.styleFrom(
              foregroundColor: SeuColors.danger,
              side: BorderSide(color: SeuColors.danger.withOpacity(0.4)),
            ),
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, top: 8, bottom: 6),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SeuColors.gray,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.leading,
    required this.title,
    this.subtitle,
    this.onTap,
  });
  final IconData leading;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: SeuRadius.lgR,
        boxShadow: SeuShadow.tile,
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: SeuColors.red.withOpacity(0.10),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Icon(leading, color: SeuColors.red, size: 18),
        ),
        title: Text(title),
        subtitle: subtitle == null
            ? null
            : Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
        trailing: const Icon(Icons.chevron_right, color: SeuColors.gray),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: SeuRadius.lgR),
      ),
    );
  }
}
