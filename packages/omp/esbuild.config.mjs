import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("../core/package.json", "utf-8"));

// OMP loads hooks via its extension runner (legacy-pi module loader) and runs
// on Bun, which handles sage-core's ESM dist (mixed require + top-level await
// in clients/amsi-spawn.js) fine. A single CJS bundle is hardening: it loads
// under any runtime, including Node-based tooling that resolves the same file.
// Note: OMP's native hook discovery only scans `.ts`/`.js` files, so a `.cjs`
// bundle must be loaded via an explicit `--hook` path, never copied into
// `hooks/pre/` or `hooks/post/`.
await esbuild.build({
	bundle: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	external: ["koffi"],
	sourcemap: true,
	entryPoints: ["src/index.ts"],
	outfile: "dist/index.cjs",
	define: { __SAGE_VERSION__: JSON.stringify(pkg.version) },
	// OMP's loader expects the default export to be the factory itself. esbuild's
	// `{ default: factory }` CJS wrapper would leave OMP holding an object, so
	// make the factory the CommonJS export.
	footer: { js: "module.exports = module.exports.default;" },
});

// Same detached workers as the other connectors. runSessionStart skips them
// when the path is missing, which is why omp never downloaded the PI model.
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

console.log("omp hook bundle build complete.");
