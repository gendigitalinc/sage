import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getPiRuntimeVersion, PI_PACKAGE_NAME, readPiPackageVersion } from "../runtime.js";

const dirs: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "sage-pi-version-"));
	dirs.push(dir);
	return dir;
}

function writePackage(dir: string, name: string, version?: string): void {
	mkdirSync(dir, { recursive: true });
	const pkg: { name: string; version?: string } = { name };
	if (version !== undefined) pkg.version = version;
	writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
}

afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs.length = 0;
});

describe("readPiPackageVersion", () => {
	it("reads the version from the package.json named @earendil-works/pi-coding-agent", () => {
		const root = tempDir();
		writePackage(root, PI_PACKAGE_NAME, "1.3.0");
		const bin = join(root, "dist", "cli.js");
		mkdirSync(join(root, "dist"), { recursive: true });
		writeFileSync(bin, "");
		expect(readPiPackageVersion(bin)).toBe("1.3.0");
	});

	it("follows a symlinked bin into the package", () => {
		const root = tempDir();
		writePackage(root, PI_PACKAGE_NAME, "1.3.0");
		const realBin = join(root, "dist", "cli.js");
		mkdirSync(join(root, "dist"), { recursive: true });
		writeFileSync(realBin, "");

		const linkDir = tempDir();
		const link = join(linkDir, "pi");
		try {
			symlinkSync(realBin, link);
		} catch (error) {
			// Creating a file symlink needs elevation on Windows; the junction
			// case below covers the same realpath walk there.
			if ((error as NodeJS.ErrnoException).code === "EPERM") return;
			throw error;
		}

		expect(readPiPackageVersion(link)).toBe("1.3.0");
		expect(getPiRuntimeVersion(link)).toBe("1.3.0");
	});

	it("follows a directory junction into the package", () => {
		const root = tempDir();
		writePackage(root, PI_PACKAGE_NAME, "1.3.0");
		mkdirSync(join(root, "dist"), { recursive: true });
		writeFileSync(join(root, "dist", "cli.js"), "");

		const linkDir = tempDir();
		const linkedDist = join(linkDir, "dist");
		if (process.platform === "win32") {
			execFileSync("cmd", ["/c", "mklink", "/J", linkedDist, join(root, "dist")]);
		} else {
			symlinkSync(join(root, "dist"), linkedDist);
		}

		expect(readPiPackageVersion(join(linkedDist, "cli.js"))).toBe("1.3.0");
	});

	it("returns undefined when no ancestor package.json is pi's", () => {
		const root = tempDir();
		writePackage(root, "some-other-package", "9.9.9");
		const bin = join(root, "bin.js");
		writeFileSync(bin, "");
		expect(readPiPackageVersion(bin)).toBeUndefined();
	});

	it("returns undefined when pi's package.json has no version", () => {
		const root = tempDir();
		writePackage(root, PI_PACKAGE_NAME);
		const bin = join(root, "bin.js");
		writeFileSync(bin, "");
		expect(readPiPackageVersion(bin)).toBeUndefined();
		expect(readPiPackageVersion(`${join(root, "bin.js")}-missing`)).toBeUndefined();
	});

	it("returns undefined when there is no entry path", () => {
		expect(readPiPackageVersion(undefined)).toBeUndefined();
		expect(getPiRuntimeVersion(undefined)).toBeUndefined();
	});
});
