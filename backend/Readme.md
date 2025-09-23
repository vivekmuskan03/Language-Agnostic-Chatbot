# Backend (Node.js / Express)

This folder contains the backend API and ingestion services.

Quick links:
- API routes: [backend/src/routes/index.js](backend/src/routes/index.js)
- Admin controller: [`uploadAndIngest`](backend/src/controllers/adminController.js)
- Learning integration: [backend/src/services/learningIntegration.js](backend/src/services/learningIntegration.js)
- LangChain helpers: [backend/src/services/langchainKnowledge.js](backend/src/services/langchainKnowledge.js)
- Student data processor: [backend/src/services/studentDataProcessor.js](backend/src/services/studentDataProcessor.js)

Setup
1. Install dependencies:
   npm install
2. Copy `.env` and set environment variables (MongoDB URI, GEMINI_API_KEY, etc.)
   cp .env.example .env && edit .env
3. Run in development:
   npm run dev
4. Common scripts:
   - `npm run start` — production start
   - `npm run dev` — development with auto-reload

Notes
- File uploads stored in `backend/uploads`.
- Vector store rebuilds are triggered via functions in [backend/src/services/learningIntegration.js](backend/src/services/learningIntegration.js).