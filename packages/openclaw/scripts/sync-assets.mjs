import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(scriptDir, "..");
const repoRoot = resolve(extensionRoot, "..", "..");

const sourceThreats = join(repoRoot, "threats");
const sourceAllowlists = join(repoRoot, "allowlists");
const sourceSkills = join(repoRoot, "skills");

const resourcesDir = join(extensionRoot, "resources");
const targetThreats = join(resourcesDir, "threats");
const targetAllowlists = join(resourcesDir, "allowlists");
const targetSkills = join(resourcesDir, "skills");

await assertReadableDir(sourceThreats);
await assertReadableDir(sourceAllowlists);
await assertReadableDir(sourceSkills);

await rm(resourcesDir, { recursive: true, force: true });
await mkdir(resourcesDir, { recursive: true });
await cp(sourceThreats, targetThreats, { recursive: true, force: true });
await cp(sourceAllowlists, targetAllowlists, { recursive: true, force: true });
await cp(sourceSkills, targetSkills, { recursive: true, force: true });

console.log("Synced openclaw assets (threats + allowlists + skills).");

async function assertReadableDir(path) {
	try {
		await access(path);
	} catch {
		throw new Error(`Missing required directory: ${path}`);
	}
}
