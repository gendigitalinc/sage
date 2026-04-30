import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	computeSkillId,
	computeSkillIdsForRoot,
	entriesFromDirectory,
	findSkillPackages,
} from "../skill-id.js";

const IS_WIN = platform() === "win32";

// Use 'junction' on Windows so directory symlinks don't require Developer
// Mode or admin. Junctions follow the same stat/realpath semantics that
// the production cycle/escape defenses rely on. Targets must be absolute
// when type is 'junction', which all callers below already pass.
async function dirSymlink(target: string, link: string): Promise<void> {
	await symlink(target, link, IS_WIN ? "junction" : "dir");
}

// File symlinks have no junction equivalent; on Windows they require
// Developer Mode or admin privileges. Probe once at module load so the
// file-symlink test can skip cleanly instead of failing with EPERM.
const canCreateFileSymlink = (() => {
	const probe = mkdtempSync(join(tmpdir(), "sage-sym-probe-"));
	try {
		const target = join(probe, "target");
		writeFileSync(target, "");
		symlinkSync(target, join(probe, "link"), "file");
		return true;
	} catch {
		return false;
	} finally {
		try {
			rmSync(probe, { recursive: true, force: true });
		} catch {
			// best effort cleanup
		}
	}
})();

describe("skill-id", () => {
	let tempRoot: string;

	beforeEach(async () => {
		tempRoot = await mkdtemp(join(tmpdir(), "sage-skill-id-"));
	});

	afterEach(async () => {
		await rm(tempRoot, { recursive: true, force: true });
	});

	describe("computeSkillId", () => {
		it("produces a stable 64-char hex digest", async () => {
			const skillDir = join(tempRoot, "audit-website");
			await mkdir(skillDir, { recursive: true });
			await writeFile(join(skillDir, "SKILL.md"), "# Audit Website\n");
			await writeFile(join(skillDir, "helper.py"), "print('hello')\n");

			const entries = await entriesFromDirectory(skillDir);
			const { skillId } = computeSkillId(entries);
			expect(skillId).toMatch(/^[0-9a-f]{64}$/);

			const entries2 = await entriesFromDirectory(skillDir);
			const { skillId: skillId2 } = computeSkillId(entries2);
			expect(skillId2).toBe(skillId);
		});

		it("returns a different digest when content changes", async () => {
			const dirA = join(tempRoot, "a");
			const dirB = join(tempRoot, "b");
			await mkdir(dirA, { recursive: true });
			await mkdir(dirB, { recursive: true });
			await writeFile(join(dirA, "SKILL.md"), "version A\n");
			await writeFile(join(dirB, "SKILL.md"), "version B\n");

			const idA = computeSkillId(await entriesFromDirectory(dirA)).skillId;
			const idB = computeSkillId(await entriesFromDirectory(dirB)).skillId;
			expect(idA).not.toBe(idB);
		});

		it("ignores skill.sig content", async () => {
			const dirA = join(tempRoot, "with-sig");
			const dirB = join(tempRoot, "no-sig");
			await mkdir(dirA, { recursive: true });
			await mkdir(dirB, { recursive: true });
			await writeFile(join(dirA, "SKILL.md"), "same content\n");
			await writeFile(join(dirA, "skill.sig"), "any-signature-bytes");
			await writeFile(join(dirB, "SKILL.md"), "same content\n");

			const idA = computeSkillId(await entriesFromDirectory(dirA)).skillId;
			const idB = computeSkillId(await entriesFromDirectory(dirB)).skillId;
			expect(idA).toBe(idB);
		});

		it("normalizes single top-level prefix when only sub-paths share a wrapper", () => {
			// The prefix-strip rule fires when every entry starts with the
			// same top-level segment (and no separate entry exists for that
			// segment itself). This matches how tar-extracted archives can
			// look. The id should be independent of the wrapper name.
			const wrappedA = computeSkillId([
				{
					entryPath: "wrap-a/SKILL.md",
					isDir: false,
					content: Buffer.from("body"),
				},
				{
					entryPath: "wrap-a/helper.py",
					isDir: false,
					content: Buffer.from("print(1)"),
				},
			]).skillId;
			const wrappedB = computeSkillId([
				{
					entryPath: "wrap-b/SKILL.md",
					isDir: false,
					content: Buffer.from("body"),
				},
				{
					entryPath: "wrap-b/helper.py",
					isDir: false,
					content: Buffer.from("print(1)"),
				},
			]).skillId;
			const unwrapped = computeSkillId([
				{
					entryPath: "SKILL.md",
					isDir: false,
					content: Buffer.from("body"),
				},
				{
					entryPath: "helper.py",
					isDir: false,
					content: Buffer.from("print(1)"),
				},
			]).skillId;
			expect(wrappedA).toBe(wrappedB);
			expect(wrappedA).toBe(unwrapped);
		});

		it("matches the algorithm formula sha256('type\\0path\\0filehash\\n')", () => {
			// Pin the algorithm so the production copy here and the master
			// probe at compute_skill_id.ts cannot silently diverge.
			const content = Buffer.from("hello\n", "utf8");
			const fileHash = createHash("sha256").update(content).digest("hex");
			const expected = createHash("sha256")
				.update(Buffer.from(`file\0SKILL.md\0${fileHash}\n`, "utf8"))
				.digest("hex");

			const { skillId } = computeSkillId([{ entryPath: "SKILL.md", isDir: false, content }]);
			expect(skillId).toBe(expected);
		});
	});

	describe("findSkillPackages", () => {
		it("finds folders containing SKILL.md", async () => {
			const a = join(tempRoot, "ext", "skills", "alpha");
			const b = join(tempRoot, "ext", "skills", "beta");
			await mkdir(a, { recursive: true });
			await mkdir(b, { recursive: true });
			await writeFile(join(a, "SKILL.md"), "a");
			await writeFile(join(b, "SKILL.md"), "b");

			// Stray files (no SKILL.md) should not match.
			await mkdir(join(tempRoot, "ext", "src"), { recursive: true });
			await writeFile(join(tempRoot, "ext", "src", "index.js"), "");

			const found = await findSkillPackages(tempRoot);
			expect(found.sort()).toEqual([a, b].sort());
		});

		it("skips node_modules / .git", async () => {
			const realSkill = join(tempRoot, "real");
			const noisySkill = join(tempRoot, "node_modules", "evil");
			await mkdir(realSkill, { recursive: true });
			await mkdir(noisySkill, { recursive: true });
			await writeFile(join(realSkill, "SKILL.md"), "real");
			await writeFile(join(noisySkill, "SKILL.md"), "evil");

			const found = await findSkillPackages(tempRoot);
			expect(found).toEqual([realSkill]);
		});

		it("returns empty list for missing or non-directory paths", async () => {
			const ghost = join(tempRoot, "does-not-exist");
			expect(await findSkillPackages(ghost)).toEqual([]);

			const file = join(tempRoot, "file.txt");
			await writeFile(file, "");
			expect(await findSkillPackages(file)).toEqual([]);
		});
	});

	describe("symlink loop protection", () => {
		it("entriesFromDirectory does not hang on a symlink loop", async () => {
			const skillDir = join(tempRoot, "loopy");
			await mkdir(skillDir, { recursive: true });
			await writeFile(join(skillDir, "SKILL.md"), "loop test\n");
			await dirSymlink(skillDir, join(skillDir, "cycle"));

			const entries = await entriesFromDirectory(skillDir);
			const paths = entries.map((e) => e.entryPath);
			expect(paths).toContain("SKILL.md");
			expect(paths.filter((p) => p === "cycle")).toHaveLength(1);
		});

		it("findSkillPackages does not hang on a symlink loop", async () => {
			const skillDir = join(tempRoot, "loopy2");
			await mkdir(skillDir, { recursive: true });
			await writeFile(join(skillDir, "SKILL.md"), "loop test\n");
			await dirSymlink(skillDir, join(skillDir, "back"));

			const found = await findSkillPackages(tempRoot);
			expect(found).toContain(skillDir);
		});

		it("entriesFromDirectory ignores symlinks that escape the root", async () => {
			const skillDir = join(tempRoot, "contained");
			await mkdir(skillDir, { recursive: true });
			await writeFile(join(skillDir, "SKILL.md"), "contained\n");
			// Symlink pointing outside the skill directory
			await dirSymlink(tempRoot, join(skillDir, "escape"));

			const entries = await entriesFromDirectory(skillDir);
			const paths = entries.map((e) => e.entryPath);
			expect(paths).toContain("SKILL.md");
			// The escape symlink dir entry is listed but not recursed into
			expect(paths).toContain("escape");
			// No files from outside the skill dir should appear
			expect(paths.filter((p) => p.startsWith("escape/"))).toHaveLength(0);
		});

		it.skipIf(!canCreateFileSymlink)(
			"entriesFromDirectory skips file symlinks that escape the root",
			async () => {
				const outsideFile = join(tempRoot, "secret.txt");
				await writeFile(outsideFile, "secret content\n");

				const skillDir = join(tempRoot, "skill-with-file-escape");
				await mkdir(skillDir, { recursive: true });
				await writeFile(join(skillDir, "SKILL.md"), "legit\n");
				await symlink(outsideFile, join(skillDir, "stolen.txt"));

				const entries = await entriesFromDirectory(skillDir);
				const paths = entries.map((e) => e.entryPath);
				expect(paths).toContain("SKILL.md");
				expect(paths).not.toContain("stolen.txt");
			},
		);

		it("findSkillPackages ignores symlinks that escape the root", async () => {
			const outsideDir = join(tempRoot, "outside");
			await mkdir(outsideDir, { recursive: true });
			await writeFile(join(outsideDir, "SKILL.md"), "outside\n");

			const pluginDir = join(tempRoot, "plugin");
			await mkdir(pluginDir, { recursive: true });
			await writeFile(join(pluginDir, "SKILL.md"), "inside\n");
			await dirSymlink(outsideDir, join(pluginDir, "sneaky"));

			const found = await findSkillPackages(pluginDir);
			expect(found).toEqual([pluginDir]);
		});
	});

	describe("computeSkillIdsForRoot", () => {
		it("returns a (folder, id) pair per skill package", async () => {
			const a = join(tempRoot, "skills", "a");
			const b = join(tempRoot, "skills", "b");
			await mkdir(a, { recursive: true });
			await mkdir(b, { recursive: true });
			await writeFile(join(a, "SKILL.md"), "alpha\n");
			await writeFile(join(b, "SKILL.md"), "beta\n");

			const out = await computeSkillIdsForRoot(tempRoot);
			expect(out).toHaveLength(2);
			for (const entry of out) {
				expect(entry.skillId).toMatch(/^[0-9a-f]{64}$/);
			}
			const ids = new Set(out.map((e) => e.skillId));
			expect(ids.size).toBe(2);
		});
	});
});
