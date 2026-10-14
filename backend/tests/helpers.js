// Shared helpers for the backend test suite.
// Each test file mocks `dotenv` (so your real .env is never loaded) and `openai`
// (so no real API calls or charges happen), then uses loadApp() to import a
// fresh copy of server.js with the environment variables that test needs.

export async function loadApp({ apiKey, allowedOrigin } = {}) {
  const { vi } = await import('vitest');
  vi.resetModules();

  if (apiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = apiKey;

  if (allowedOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
  else process.env.ALLOWED_ORIGIN = allowedOrigin;

  const { default: app } = await import('../server.js');
  return app;
}
