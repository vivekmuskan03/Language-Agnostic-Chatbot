# Frontend (React + Vite)

This folder contains the React frontend.

Quick links:
- Main admin UI: [frontend/src/pages/AdminDashboard.jsx](frontend/src/pages/AdminDashboard.jsx)
- Chat UI: [frontend/src/pages/Chat.jsx](frontend/src/pages/Chat.jsx)
- Styles: [frontend/src/pages/styles.css](frontend/src/pages/styles.css)
- Vite config: [vite.config.js](frontend/vite.config.js)
- API base: defined in [frontend/src/pages/AdminDashboard.jsx](frontend/src/pages/AdminDashboard.jsx)

Setup
1. Install dependencies:
   npm install
2. Start dev server:
   npm run dev
3. Build for production:
   npm run build

Notes
- API base is read from `import.meta.env.VITE_API_BASE`.
- Admin pages call endpoints defined in [backend/src/routes/index.js](backend/src/routes/index.js).