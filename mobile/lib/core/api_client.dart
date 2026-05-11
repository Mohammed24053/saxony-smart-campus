import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();

const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

class ApiClient {
  final Dio dio;

  ApiClient._(this.dio);

  factory ApiClient.create() {
    final dio = Dio(BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));
    final client = ApiClient._(dio);
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'accessToken');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        final alreadyRetried = e.requestOptions.extra['__retried'] == true;
        if (e.response?.statusCode == 401 && !alreadyRetried) {
          final ok = await client._tryRefresh();
          if (ok) {
            e.requestOptions.extra['__retried'] = true;
            final retry = await dio.fetch(e.requestOptions);
            return handler.resolve(retry);
          }
        }
        handler.next(e);
      },
    ));
    return client;
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _storage.read(key: 'refreshToken');
    if (refresh == null) return false;
    try {
      final r = await Dio().post('$kApiBaseUrl/auth/refresh', data: {'refreshToken': refresh});
      final data = r.data['data'];
      await _storage.write(key: 'accessToken', value: data['accessToken'] as String);
      await _storage.write(key: 'refreshToken', value: data['refreshToken'] as String);
      return true;
    } catch (_) {
      return false;
    }
  }
}
