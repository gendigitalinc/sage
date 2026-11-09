import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("../core/package.json", "utf-8"));

// pi runs extensions on Node via jiti; a single CJS bundle avoids loading
// sage-core's ESM dist, which Node rejects (mixed require + top-level await).
await esbuild.build({
	bundle: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	sourcemap: true,
	external: ["koffi"],
	entryPoints: ["src/index.ts"],
	outfile: "dist/index.cjs",
	define: { __SAGE_VERSION__: JSON.stringify(pkg.version) },
	// pi loads the bundle via `jiti.import(path, { default: true })`, which on
	// Node is a native `import()` of CJS: `default` is `module.exports`, unwrapped
	// once. esbuild's `{ default: factory }` wrapper would leave pi holding an
	// object, so make the factory itself the CommonJS export.
	footer: { js: "module.exports = module.exports.default;" },
});

// Sage MCP server (sage_report_false_positive / sage_list_audit_entries),
// registered by the extension via pi.registerMcpServer. Taken from
// vaclavbelak/pi-sage (bin/mcp-server.mjs); bundled like the OpenCode
// connector's MCP server so it runs on plain Node with no install step.
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

// Detached workers runSessionStart spawns when the PI model is missing or a
// skill upload is queued. Without these, pi sessions never download the model
// and the version-check/heartbeat path has nothing to pair with.
for (const worker of ["model-download-worker", "skill-upload-worker"]) {
	await esbuild.build({
		bundle: true,
		platform: "node",
		target: "node18",
		format: "cjs",
		sourcemap: true,
		external: ["koffi"],
		entryPoints: [`../core/src/${worker}.ts`],
		outfile: `dist/${worker}.cjs`,
		define: { __SAGE_VERSION__: JSON.stringify(pkg.version) },
	});
}

console.log("pi extension build complete.");
