import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("../core/package.json", "utf-8"));

await esbuild.build({
	bundle: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	sourcemap: true,
	external: ["koffi"],
	entryPoints: ["src/mcp-server.ts"],
	outfile: "dist/mcp-server.cjs",
	define: { __SAGE_VERSION__: JSON.stringify(pkg.version) },
});

console.log("MCP server build complete.");
