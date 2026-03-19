/**
 * Prepack guard: rejects publish if any workspace: references remain in
 * package.json AND the publish is not running under pnpm.
 *
 * pnpm publish resolves workspace: refs automatically in the tarball,
 * so the check only fires for npm/yarn where refs would leak verbatim.
 */

import { readFileSync } from "node:fs";

const userAgent = process.env.npm_config_user_agent || "";
if (userAgent.includes("pnpm")) {
	// pnpm resolves workspace: refs in the packed tarball automatically.
	process.exit(0);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const fields = [
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
];

const violations = [];
for (const field of fields) {
	const deps = pkg[field];
	if (!deps) continue;
	for (const [name, version] of Object.entries(deps)) {
		if (typeof version === "string" && version.startsWith("workspace:")) {
			violations.push(`  ${field} → ${name}: ${version}`);
		}
	}
}

if (violations.length > 0) {
	console.error("ERROR: unresolved workspace: references in package.json:");
	for (const v of violations) console.error(v);
	console.error(
		"\nUse `pnpm publish` to resolve workspace references automatically,",
	);
	console.error(
		"or replace workspace: refs with concrete version numbers before publishing.",
	);
	process.exit(1);
}
