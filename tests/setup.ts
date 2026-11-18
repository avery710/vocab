import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { getPool } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://vocab:vocab@localhost:5432/vocab_test";

beforeAll(async () => {
  await getPool().query(readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
});

beforeEach(async () => {
  resetRateLimits();
  await getPool().query("truncate words, word_links, oauth_codes, api_tokens, oauth_clients cascade");
});

afterAll(async () => {
  await getPool().end();
  globalThis.__vocabPool = undefined;
});
