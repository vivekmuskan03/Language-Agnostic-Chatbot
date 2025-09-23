# mobile_app (Flutter)

This folder contains the Flutter mobile/desktop/web client for the Vignan Chatbot.

Quick links
- API client: lib/services/api_client.dart
- Timetable screen: lib/screens/timetable_screen.dart
- Windows runner: windows/runner/flutter_window.h
- Android config: android/app/build.gradle.kts
- Web entry: web/index.html

Prerequisites
- Flutter SDK installed and on PATH (see https://flutter.dev).
- Android Studio / Xcode for device emulators and platform tooling.

Important: network and server settings
- The mobile device or emulator must be on the same network as the backend server.
- In the mobile app server settings (API base URL), use the backend machine's IPv4 address (for example `http://192.168.1.10:5000`) — do not use `localhost` or `127.0.0.1` from a physical device.
- Emulator exceptions:
  - Android emulator (default): use `http://10.0.2.2:<port>` to reach host localhost.
  - Android Genymotion: use `http://10.0.3.2:<port>`.
  - iOS Simulator: `http://localhost:<port>` works if backend runs on the same macOS host.
- Verify your firewall allows incoming connections on the backend port.

Configure API base URL
- Open lib/services/api_client.dart (or the config file used) and set the base URL:
  - Example: const String BASE_URL = 'http://192.168.1.10:5000/api';
- Rebuild the app after changing configuration.

Run (development)
1. Get packages:
   flutter pub get
2. Run on device/emulator:
   - Android emulator: flutter run -d emulator-5554
   - Android device: flutter run -d <device-id>
   - iOS simulator (macOS): flutter run -d ios
   - Windows: flutter run -d windows
   - Web: flutter run -d chrome

Build (release)
- Android APK: flutter build apk --release
- iOS (archive): open ios/Runner.xcworkspace in Xcode and archive
- Windows: flutter build windows
- Web: flutter build web

Troubleshooting
- If the app cannot reach the server:
  - Confirm both devices are on the same local network.
  - Confirm the backend is listening on 0.0.0.0 (not only localhost) and firewall rules permit access.
  - Use the backend IPv4 address in the app settings.
  - For emulators, use the platform-specific host mappings noted above.
- Logs: use flutter run to view runtime logs and network errors.

Notes
- Native runner code (Windows) lives in windows/runner — changes may require `flutter clean` and a rebuild.
- Keep API paths consistent between backend and mobile client.

```// filepath: f:\MSD Project\chatbot\mobile_app\README.md

# mobile_app (Flutter)

This folder contains the Flutter mobile/desktop/web client for the Vignan Chatbot.

Quick links
- API client: lib/services/api_client.dart
- Timetable screen: lib/screens/timetable_screen.dart
- Windows runner: windows/runner/flutter_window.h
- Android config: android/app/build.gradle.kts
- Web entry: web/index.html

Prerequisites
- Flutter SDK installed and on PATH (see https://flutter.dev).
- Android Studio / Xcode for device emulators and platform tooling.

Important: network and server settings
- The mobile device or emulator must be on the same network as the backend server.
- In the mobile app server settings (API base URL), use the backend machine's IPv4 address (for example `http://192.168.1.10:5000`) — do not use `localhost` or `127.0.0.1` from a physical device.
- Emulator exceptions:
  - Android emulator (default): use `http://10.0.2.2:<port>` to reach host localhost.
  - Android Genymotion: use `http://10.0.3.2:<port>`.
  - iOS Simulator: `http://localhost:<port>` works if backend runs on the same macOS host.
- Verify your firewall allows incoming connections on the backend port.

Configure API base URL
- Open lib/services/api_client.dart (or the config file used) and set the base URL:
  - Example: const String BASE_URL = 'http://192.168.1.10:5000/api';
- Rebuild the app after changing configuration.

Run (development)
1. Get packages:
   flutter pub get
2. Run on device/emulator:
   - Android emulator: flutter run -d emulator-5554
   - Android device: flutter run -d <device-id>
   - iOS simulator (macOS): flutter run -d ios
   - Windows: flutter run -d windows
   - Web: flutter run -d chrome

Build (release)
- Android APK: flutter build apk --release
- iOS (archive): open ios/Runner.xcworkspace in Xcode and archive
- Windows: flutter build windows
- Web: flutter build web

Troubleshooting
- If the app cannot reach the server:
  - Confirm both devices are on the same local network.
  - Confirm the backend is listening on 0.0.0.0 (not only localhost) and firewall rules permit access.
  - Use the backend IPv4 address in the app settings.
  - For emulators, use the platform-specific host mappings noted above.
- Logs: use flutter run to view runtime logs and network errors.

Notes
- Native runner code (Windows) lives in windows/runner — changes may require `flutter clean` and a rebuild.
- Keep API paths consistent between backend and mobile client.
