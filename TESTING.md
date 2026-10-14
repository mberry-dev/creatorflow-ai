# Testing

CreatorFlow AI has **111 automated tests**: 48 backend API tests and 63 frontend component tests. No test calls the real OpenAI API or Firebase, so the suite is free to run and gives the same result every time.

## Run the tests

```bash
# Backend: Vitest + Supertest (48 tests)
cd backend
npm install
npm test

# Frontend: Jest + React Testing Library (63 tests)
cd frontend
npm install
npm test -- --watchAll=false
```

## Backend: API integration tests (`backend/tests/`)

Each test sends a real HTTP request through the Express app with Supertest. The OpenAI client and `dotenv` are mocked.

| File | Tests | What it covers |
|---|---|---|
| `api.mock-mode.test.js` | 25 | `/api/status`, `/api/health`, the 400 response for a missing or empty topic on all 4 generate endpoints, malformed JSON, mock-engine output for titles, descriptions, hashtags and SEO, the 404 for unknown routes, CORS headers and preflight |
| `api.openai.test.js` | 23 | Live-mode detection (including `/api/health`) and handling of the placeholder key, prompt construction (model, JSON mode, platform character limits of 100/150 for titles and 2200/5000 for descriptions, tone and platform), response parsing, and fallback to the mock engine when OpenAI errors or returns invalid JSON |

## Frontend: component tests (`frontend/src/`)

Firebase Auth, Firestore, `fetch` and `axios` are mocked.

| File | Tests | What it covers |
|---|---|---|
| `App.test.js` | 11 | Loading shell, logged-out vs logged-in navigation, backend status Online/Offline, sign out, auth listener cleanup, route guards for `/dashboard`, `/login` and `/register` |
| `ProtectedRoute.test.js` | 2 | Redirect when unauthenticated (FR-01.7); render children when authenticated |
| `Login.test.js` | 5 | Fields, successful sign-in with redirect, Firebase error display, loading state, register link |
| `Register.test.js` | 6 | Fields, account creation with redirect, weak-password and duplicate-email errors, loading state, login link |
| `components/AIToolStudio.test.js` | 29 | All 4 generators (endpoint, payload, rendering), loading/error/empty states, templates, copy to clipboard, saving to Firestore (logged in, logged out, failure), the vault query scoped to the user, newest-first ordering, delete, wipe (confirm and cancel), CSV/JSON export, analytics and settings tabs |
| `components/AnalyticsDashboard.test.js` | 5 | Empty state, category counts and percentages, Hashtags + SEO combined, uncategorized assets, progress-bar widths |
| `components/UserProfileSettings.test.js` | 5 | Loading saved preferences, defaults, saving with merge, save failure, logged-out guard |
