import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

const _storage = FlutterSecureStorage();

class AuthUser {
  final String id;
  final String email;
  final String name;
  final String role;
  final String universityId;

  AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.universityId,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        role: json['role'] as String,
        universityId: json['universityId'] as String,
      );
}

final apiProvider = Provider<ApiClient>((ref) => ApiClient.create());

/// `true` while the app is still attempting to rehydrate the auth state from
/// secure storage on cold boot. The splash screen waits on this flag before
/// routing so we don't flash the login screen for users whose tokens are
/// still valid (fixes P0-8 "silent session restore").
final authBootingProvider = StateProvider<bool>((ref) => true);

class AuthNotifier extends StateNotifier<AuthUser?> {
  final Ref ref;
  AuthNotifier(this.ref) : super(null) {
    // Fire-and-forget: rehydrate via `/me` if we have an access token in
    // secure storage. Failure paths (no token, expired refresh, network
    // error) all leave `state == null` which routes the user to /login.
    _restore();
  }

  Future<void> _restore() async {
    try {
      final access = await _storage.read(key: 'accessToken');
      final refresh = await _storage.read(key: 'refreshToken');
      if (access == null && refresh == null) return;
      final api = ref.read(apiProvider);
      // GET /me — the api_client interceptor will automatically refresh on
      // a 401 using the stored refresh token, so this single call also
      // exercises the refresh path.
      final r = await api.dio.get('/me');
      final data = r.data['data'] as Map<String, dynamic>?;
      if (data == null) return;
      state = AuthUser.fromJson(data);
    } catch (_) {
      // Best-effort: clear tokens so the next login starts clean.
      try {
        await _storage.delete(key: 'accessToken');
        await _storage.delete(key: 'refreshToken');
      } catch (_) {/* ignore */}
    } finally {
      // Always release the splash gate so the UI can route.
      ref.read(authBootingProvider.notifier).state = false;
    }
  }

  Future<({bool requires2fa, String? error})> login(
    String email,
    String password, {
    String? code,
  }) async {
    final api = ref.read(apiProvider);
    try {
      final r = await api.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
        if (code != null) 'twoFactorCode': code,
      });
      final data = r.data['data'];
      await _storage.write(key: 'accessToken', value: data['accessToken'] as String);
      await _storage.write(key: 'refreshToken', value: data['refreshToken'] as String);
      state = AuthUser.fromJson(data['user']);
      return (requires2fa: false, error: null);
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('TWO_FA_REQUIRED')) return (requires2fa: true, error: null);
      return (requires2fa: false, error: 'Login failed');
    }
  }

  Future<void> logout() async {
    final api = ref.read(apiProvider);
    final refreshToken = await _storage.read(key: 'refreshToken');
    try {
      if (refreshToken != null) {
        await api.dio.post('/auth/logout', data: {'refreshToken': refreshToken});
      }
    } catch (_) {/* ignore */}
    await _storage.delete(key: 'accessToken');
    await _storage.delete(key: 'refreshToken');
    state = null;
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthUser?>(
  (ref) => AuthNotifier(ref),
);
