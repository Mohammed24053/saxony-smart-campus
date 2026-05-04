import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth_state.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController(text: 'admin@saxony-egypt.edu');
  final _password = TextEditingController();
  final _otpCtrls = List.generate(6, (_) => TextEditingController());
  final _otpFocus = List.generate(6, (_) => FocusNode());
  bool _needs2fa = false;
  bool _loading = false;
  String? _error;
  bool _showShake = false;
  String _role = 'Student';

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    for (final c in _otpCtrls) {
      c.dispose();
    }
    for (final f in _otpFocus) {
      f.dispose();
    }
    super.dispose();
  }

  String get _otpValue => _otpCtrls.map((c) => c.text).join();

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final code = _otpValue;
    final r = await ref.read(authProvider.notifier).login(
          _email.text.trim(),
          _password.text,
          code: code.length == 6 ? code : null,
        );
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (r.requires2fa) _needs2fa = true;
      _error = r.error;
    });
    if (r.error != null) {
      _triggerShake();
      return;
    }
    if (ref.read(authProvider) != null) context.go('/home');
  }

  void _triggerShake() {
    setState(() => _showShake = true);
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _showShake = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: SeuColors.cream,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 32),
                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: SeuColors.red,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: SeuColors.gold, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: SeuColors.red.withOpacity(0.25),
                          blurRadius: 24,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'SE',
                        style: TextStyle(
                          color: SeuColors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ).animate().scale(
                      begin: const Offset(0.8, 0.8),
                      end: const Offset(1, 1),
                      duration: const Duration(milliseconds: 400),
                      curve: SeuMotion.bounce,
                    ),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    'Smart Campus',
                    style: theme.textTheme.headlineLarge,
                  ),
                ),
                const SizedBox(height: 4),
                Center(
                  child: Text(
                    'Saxony Egypt University',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: SeuColors.gray,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                _RoleToggle(
                  value: _role,
                  onChanged: (v) => setState(() => _role = v),
                ),
                const SizedBox(height: 20),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  switchInCurve: Curves.easeOutCubic,
                  child: _needs2fa
                      ? _OtpForm(
                          key: const ValueKey('otp'),
                          controllers: _otpCtrls,
                          focusNodes: _otpFocus,
                          showShake: _showShake,
                          error: _error,
                        )
                      : _CredentialsForm(
                          key: const ValueKey('cred'),
                          email: _email,
                          password: _password,
                          showShake: _showShake,
                          error: _error,
                        ),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: SeuColors.white,
                            strokeWidth: 2.5,
                          ),
                        )
                      : Text(_needs2fa ? 'Verify code' : 'Sign in'),
                ),
                if (!_needs2fa) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Biometric sign-in coming soon'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.fingerprint),
                    label: const Text('Sign in with biometrics'),
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

class _RoleToggle extends StatelessWidget {
  const _RoleToggle({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: SeuColors.navy.withOpacity(0.06),
        borderRadius: SeuRadius.xlR,
      ),
      child: Row(
        children: [
          for (final option in const ['Student', 'Doctor'])
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(option),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: value == option ? SeuColors.white : Colors.transparent,
                    borderRadius: SeuRadius.xlR,
                    boxShadow: value == option
                        ? [
                            BoxShadow(
                              color: SeuColors.navy.withOpacity(0.06),
                              blurRadius: 10,
                            )
                          ]
                        : null,
                  ),
                  child: Center(
                    child: Text(
                      option,
                      style: TextStyle(
                        color: value == option
                            ? SeuColors.navy
                            : SeuColors.gray,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CredentialsForm extends StatelessWidget {
  const _CredentialsForm({
    super.key,
    required this.email,
    required this.password,
    required this.showShake,
    required this.error,
  });
  final TextEditingController email;
  final TextEditingController password;
  final bool showShake;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final fields = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: 'Email or Student ID',
            prefixIcon: Icon(Icons.alternate_email, size: 20),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: password,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Password',
            prefixIcon: Icon(Icons.lock_outline, size: 20),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(message: error!),
        ],
      ],
    );
    return showShake
        ? fields.animate().shake(
              hz: 6,
              offset: const Offset(8, 0),
              duration: const Duration(milliseconds: 400),
            )
        : fields;
  }
}

class _OtpForm extends StatelessWidget {
  const _OtpForm({
    super.key,
    required this.controllers,
    required this.focusNodes,
    required this.showShake,
    required this.error,
  });

  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;
  final bool showShake;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final group = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Enter the 6-digit code from your authenticator app',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: SeuColors.gray,
              ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (var i = 0; i < 6; i++)
              SizedBox(
                width: 44,
                child: TextField(
                  controller: controllers[i],
                  focusNode: focusNodes[i],
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  maxLength: 1,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    contentPadding: EdgeInsets.symmetric(vertical: 14),
                  ),
                  onChanged: (v) {
                    if (v.length == 1 && i < 5) {
                      focusNodes[i + 1].requestFocus();
                    }
                    if (v.isEmpty && i > 0) {
                      focusNodes[i - 1].requestFocus();
                    }
                  },
                ),
              ),
          ],
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(message: error!),
        ],
      ],
    );
    return showShake
        ? group.animate().shake(
              hz: 6,
              offset: const Offset(8, 0),
              duration: const Duration(milliseconds: 400),
            )
        : group;
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: SeuColors.danger.withOpacity(0.08),
        borderRadius: SeuRadius.mdR,
        border: Border.all(color: SeuColors.danger.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline,
              color: SeuColors.danger, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: SeuColors.danger, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
