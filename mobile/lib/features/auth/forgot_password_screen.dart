import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';

/// Mobile counterpart of the admin web's `/forgot-password` page. The backend
/// always returns 200 (so the existence of the email is not leaked); we just
/// surface a generic confirmation regardless of outcome.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiProvider);
      await api.dio.post('/auth/password/forgot', data: {
        'email': _email.text.trim(),
      });
      if (!mounted) return;
      setState(() => _sent = true);
    } catch (_) {
      // Treat as success — don't leak whether the email exists.
      if (!mounted) return;
      setState(() => _sent = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    return Scaffold(
      backgroundColor: SeuColors.cream,
      appBar: AppBar(
        backgroundColor: SeuColors.cream,
        foregroundColor: SeuColors.navy,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  s.t('auth.forgotPassword'),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter your email — we\'ll send a reset link if your account exists.',
                  style: TextStyle(color: SeuColors.gray, fontSize: 13),
                ),
                const SizedBox(height: 24),
                if (!_sent) ...[
                  TextField(
                    controller: _email,
                    autofocus: true,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: s.t('auth.email'),
                      errorText: _error,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _loading ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: SeuColors.red,
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: SeuColors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : Text(s.t('auth.forgotPassword')),
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: SeuColors.white,
                      borderRadius: BorderRadius.circular(SeuRadius.lg),
                      boxShadow: SeuShadow.tile,
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.mark_email_read,
                            color: SeuColors.success),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'If an account exists, a reset email has been sent.',
                            style: TextStyle(
                              fontSize: 13,
                              color: SeuColors.navy,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () => context.go('/login'),
                    child: Text(s.t('common.back')),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
