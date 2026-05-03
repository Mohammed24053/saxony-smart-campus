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

class AuthNotifier extends StateNotifier<AuthUser?> {
  final Ref ref;
  AuthNotifier(this.ref) : super(null) {
    _restore();
  }

  Future<void> _restore() async {
    // We don't deserialize the user from storage — caller refetches profile.
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
    try {
      await api.dio.post('/auth/logout');
    } catch (_) {/* ignore */}
    await _storage.delete(key: 'accessToken');
    await _storage.delete(key: 'refreshToken');
    state = null;
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthUser?>(
  (ref) => AuthNotifier(ref),
);
