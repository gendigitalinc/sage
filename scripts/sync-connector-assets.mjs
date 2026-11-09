// Copies the repo-root threats/ and trusted-domains/ into the current package's
// resources/. Run from a connector package directory (pi, omp) at pack time so the
// published tarball is self-contained; in the monorepo the connectors read the
// repo-root folders directly.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resourcesDir = resolve(process.cwd(), "resources");

rmSync(resourcesDir, { recursive: true, force: true });
mkdirSync(resourcesDir, { recursive: true });
for (const name of ["threats", "trusted-domains"]) {
	cpSync(join(repoRoot, name), join(resourcesDir, name), { recursive: true });
}
console.log(`Synced threats + trusted-domains into ${resourcesDir}`);
