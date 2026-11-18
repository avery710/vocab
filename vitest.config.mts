import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against a real Postgres: TEST_DATABASE_URL (default: local
// vocab_test). tests/setup.ts applies db/schema.sql and empties the tables.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
  },
});
