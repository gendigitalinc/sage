/**
 * OMP skill-root resolution. Pinned because an agent-dir override that sage
 * ignores means personal skills are never scanned.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOmpSkillRoots } from "../session.js";

const CWD = join("/work", "project");
const personalSkillDirs = (cwd: string) =>
	resolveOmpSkillRoots(cwd)
		.filter((root) => root.scope === "personal")
		.map((root) => root.dir);

describe("resolveOmpSkillRoots", () => {
	const original = process.env.PI_CODING_AGENT_DIR;

	afterEach(() => {
		if (original === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = original;
	});

	it("defaults the agent dir to ~/.omp/agent", () => {
		delete process.env.PI_CODING_AGENT_DIR;
		expect(personalSkillDirs(CWD)).toContain(join(homedir(), ".omp", "agent", "skills"));
	});

	it("honors a PI_CODING_AGENT_DIR override", () => {
		process.env.PI_CODING_AGENT_DIR = join("/custom", "agent");
		expect(personalSkillDirs(CWD)).toContain(join("/custom", "agent", "skills"));
	});

	it("always includes the project skill root under the cwd", () => {
		delete process.env.PI_CODING_AGENT_DIR;
		const projectDirs = resolveOmpSkillRoots(CWD)
			.filter((root) => root.scope === "project")
			.map((root) => root.dir);
		expect(projectDirs).toContain(join(CWD, ".omp", "skills"));
	});
});
