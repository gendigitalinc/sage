import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("../core/package.json", "utf-8"));

// pi runs extensions on Node via jiti; a single CJS bundle avoids loading
// sage-core's ESM dist, which Node rejects (mixed require + top-level await).
await esbuild.build({
	bundle: true,
	platform: "node",
	target: "node22",
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

console.log("pi extension build complete.");
