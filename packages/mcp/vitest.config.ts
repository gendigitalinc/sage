import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "mcp",
		environment: "node",
		include: ["src/**/*.{test,spec}.ts"],
		exclude: ["**/node_modules/**", "**/.git/**", "dist/**"],
	},
});

