import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the database-mutation suites race each other — they share rows that are unique
    // by construction (a central course standard may exist once per year). Serialise the
    // run only when that gate is open, so the ordinary run stays parallel and fast.
    fileParallelism: process.env.RUN_DATABASE_MUTATION_TESTS !== "1",
  },
});
