import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "hook-host",
		environment: "node",
		include: ["src/**/*.{test,spec}.ts"],
		exclude: ["**/node_modules/**", "**/.git/**", "dist/**"],
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
