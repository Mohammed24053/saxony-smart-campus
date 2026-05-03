# Saxony Smart Campus — Mobile

Flutter app for students and doctors. Code-only scaffold; run `flutter create .`
to generate the platform projects (Android / iOS / Web), then `flutter pub get`.

## Stack

- Riverpod (state)
- GoRouter (routing)
- Dio (HTTP) with refresh-token interceptor
- mobile_scanner (QR camera) + geolocator (GPS)
- Firebase Cloud Messaging + flutter_local_notifications
- Hive + flutter_secure_storage (offline cache + tokens)

## Configure

Pass the API base URL at compile time:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

Default is `http://10.0.2.2:3000/api/v1` (Android emulator → host).

## Screens

| Route            | Screen                                           |
| ---------------- | ------------------------------------------------ |
| `/login`         | Email + password + 2FA code (admin only)         |
| `/`              | My Schedule                                      |
| `/scan`          | Scan attendance QR (camera + GPS)                |
| `/history`       | My attendance history                            |
| `/notifications` | Notification inbox                               |
| `/profile`       | User profile + sign out                          |

## Permissions to add (after `flutter create .`)

- Android: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
  `INTERNET`, `POST_NOTIFICATIONS` in `android/app/src/main/AndroidManifest.xml`
- iOS: `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription` in
  `ios/Runner/Info.plist`

Add Firebase config files (`google-services.json`, `GoogleService-Info.plist`)
to enable FCM push.
