import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/locale_provider.dart';
import '../../core/strings.dart';
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
          _BiometricToggle(),
          const SizedBox(height: 16),
          _SectionLabel('Account'),
          _SettingsTile(
            leading: Icons.lock_outline,
            title: 'Change password',
            onTap: () => _showChangePassword(context, ref),
          ),
          _SettingsTile(
            leading: Icons.devices_other,
            title: 'Log out all devices',
            subtitle: 'Sign out from every browser and phone',
            onTap: () => _confirmLogoutAll(context, ref),
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

Future<void> _showChangePassword(BuildContext context, WidgetRef ref) async {
  final current = TextEditingController();
  final next = TextEditingController();
  final formKey = GlobalKey<FormState>();
  bool loading = false;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetCtx) => StatefulBuilder(
      builder: (sheetCtx, setState) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(sheetCtx).viewInsets.bottom + 16,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppStrings.of(sheetCtx).t('profile.changePassword'),
                style: Theme.of(sheetCtx).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: current,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: AppStrings.of(sheetCtx).t('profile.currentPassword'),
                ),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: next,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: AppStrings.of(sheetCtx).t('profile.newPassword'),
                ),
                validator: (v) =>
                    (v == null || v.length < 8) ? 'Min 8 characters' : null,
              ),
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: SeuColors.red),
                onPressed: loading
                    ? null
                    : () async {
                        if (!(formKey.currentState?.validate() ?? false)) return;
                        setState(() => loading = true);
                        try {
                          final api = ref.read(apiProvider);
                          await api.dio.post('/me/change-password', data: {
                            'currentPassword': current.text,
                            'newPassword': next.text,
                          });
                          if (sheetCtx.mounted) Navigator.of(sheetCtx).pop();
                        } catch (e) {
                          if (sheetCtx.mounted) {
                            ScaffoldMessenger.of(sheetCtx).showSnackBar(
                              const SnackBar(
                                  content: Text('Could not change password')),
                            );
                          }
                        } finally {
                          if (sheetCtx.mounted) setState(() => loading = false);
                        }
                      },
                child: loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(AppStrings.of(sheetCtx).t('profile.changePassword')),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

Future<void> _confirmLogoutAll(BuildContext context, WidgetRef ref) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dctx) => AlertDialog(
      title: const Text('Log out all devices?'),
      content: const Text(
          'This will sign you out from every browser and phone. You\'ll need to sign in again.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: SeuColors.red),
          onPressed: () => Navigator.pop(dctx, true),
          child: const Text('Log out everywhere'),
        ),
      ],
    ),
  );
  if (confirmed != true) return;
  try {
    await ref.read(apiProvider).dio.delete('/me/sessions');
  } catch (_) {/* ignore */}
  await ref.read(authProvider.notifier).logout();
  if (context.mounted) context.go('/login');
}

class _BiometricToggle extends ConsumerStatefulWidget {
  @override
  ConsumerState<_BiometricToggle> createState() => _BiometricToggleState();
}

class _BiometricToggleState extends ConsumerState<_BiometricToggle> {
  static const _storage = FlutterSecureStorage();
  bool _enabled = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _read();
  }

  Future<void> _read() async {
    final v = await _storage.read(key: 'biometricEnabled');
    if (!mounted) return;
    setState(() {
      _enabled = v == 'true';
      _loading = false;
    });
  }

  Future<void> _toggle(bool v) async {
    setState(() => _enabled = v);
    await _storage.write(key: 'biometricEnabled', value: v ? 'true' : 'false');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: SeuColors.white,
        borderRadius: SeuRadius.lgR,
        boxShadow: SeuShadow.tile,
      ),
      child: SwitchListTile.adaptive(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        secondary: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: SeuColors.red.withOpacity(0.10),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.fingerprint, color: SeuColors.red, size: 18),
        ),
        title: const Text('Biometric sign-in'),
        subtitle: const Text('Use Face ID / fingerprint to sign in'),
        value: _loading ? false : _enabled,
        onChanged: _loading ? null : _toggle,
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
