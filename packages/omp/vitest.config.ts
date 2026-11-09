import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "omp",
		environment: "node",
		// Parallel `pnpm test` load flakes the default 5s timeout; projects don't
		// inherit the root test timeout. See packages/core/vitest.config.ts.
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
