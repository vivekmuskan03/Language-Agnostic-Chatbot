# Vignan Chatbot — Monorepo (Instructions & Quick Start)

This repo contains:
- backend/ — Node.js + Express API and ingestion services
- frontend/ — React + Vite web UI
- mobile_app/ — Flutter client (Android, iOS, Web, Desktop)

Prerequisites
- Node.js (16+) and npm
- MongoDB (or configured DB)
- Flutter SDK (for mobile_app)
- Android Studio / Xcode / Visual Studio as needed

Environment & configuration
- Backend: copy `.env.example` → `.env` and set MONGODB_URI, PORT (default 5000), API keys. Ensure server binds to 0.0.0.0 for LAN access.
- Frontend: set VITE_API_BASE in `frontend/.env` or use `import.meta.env.VITE_API_BASE`.
- Mobile: set backend URL in `mobile_app/lib/services/api_client.dart` or app settings.

Start services (recommended order)
1. Backend
   - cd backend
   - npm install
   - edit `.env`
   - npm run dev
2. Frontend
   - cd frontend
   - npm install
   - set VITE_API_BASE to backend URL (e.g. http://192.168.1.10:5000/api)
   - npm run dev
3. Mobile app
   - cd mobile_app
   - flutter pub get
   - flutter run -d <device>

Mobile networking (critical)
- Physical devices must be on the same network as the backend host.
- Use the backend machine's IPv4 (example: http://192.168.1.10:5000 or http://192.168.1.10:5000/api).
- Do NOT use localhost / 127.0.0.1 from a physical device.
- Emulator shortcuts:
  - Android AVD: http://10.0.2.2:<port>
  - Genymotion: http://10.0.3.2:<port>
  - iOS Simulator (macOS): localhost:<port> when backend runs on the same host
- Ensure backend listens on 0.0.0.0 and firewall allows inbound on the chosen port.


Troubleshooting checklist
- "Cannot reach server": confirm same Wi‑Fi, correct IPv4, backend bound to 0.0.0.0, firewall rules.
- CORS: enable appropriate origins in backend during dev.
- Mobile native changes not applied: flutter clean && flutter pub get && rebuild.

Where to edit
- backend/src — routes, controllers, services
- frontend/src — React app
- mobile_app/lib — Flutter app code (API base: lib/services/api_client.dart)



