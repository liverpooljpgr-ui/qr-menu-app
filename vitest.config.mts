import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Every assertion is a round-trip to the remote Supabase project.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
