import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(scriptDir, "..");
const repoRoot = resolve(extensionRoot, "..", "..");

const sourceThreats = join(repoRoot, "threats");
const sourceAllowlists = join(repoRoot, "allowlists");

const resourcesDir = join(extensionRoot, "resources");
const targetThreats = join(resourcesDir, "threats");
const targetAllowlists = join(resourcesDir, "allowlists");

await assertReadableDir(sourceThreats);
await assertReadableDir(sourceAllowlists);

await rm(resourcesDir, { recursive: true, force: true });
await mkdir(resourcesDir, { recursive: true });
await cp(sourceThreats, targetThreats, { recursive: true, force: true });
await cp(sourceAllowlists, targetAllowlists, { recursive: true, force: true });

// ML models are downloaded on demand into ~/.sage/models/<schema>/<name>/
// at session start; the extension no longer ships them in the VSIX.
// See docs/model-update.md.

console.log("Synced extension assets (threats + allowlists).");

async function assertReadableDir(path) {
	try {
		await access(path);
	} catch {
		throw new Error(`Missing required directory: ${path}`);
	}
}
