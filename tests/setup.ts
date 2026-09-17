// @next/env deliberately skips .env.local when NODE_ENV=test (which Vitest sets),
// so load it directly. Missing file is fine — the suite skips without the secret key.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local (e.g. CI) — env must come from the environment itself
}
