import { describe, expect, it } from "vitest";

import { resolveClaudeCodeVersion } from "../runtime-version.js";

describe("resolveClaudeCodeVersion", () => {
	it("reads the version from a CLAUDE_CODE_EXECPATH /versions/<v> directory", () => {
		expect(
			resolveClaudeCodeVersion({
				CLAUDE_CODE_EXECPATH: "/Users/u/.local/share/claude/versions/2.1.150",
			}),
		).toBe("2.1.150");
	});

	it("reads the version when CLAUDE_CODE_EXECPATH points at a file inside the version dir", () => {
		expect(
			resolveClaudeCodeVersion({
				CLAUDE_CODE_EXECPATH: "/Users/u/.local/share/claude/versions/2.1.150/cli.js",
			}),
		).toBe("2.1.150");
	});

	it("preserves a prerelease suffix in the version directory", () => {
		expect(
			resolveClaudeCodeVersion({
				CLAUDE_CODE_EXECPATH: "/opt/claude/versions/2.2.0-rc.1",
			}),
		).toBe("2.2.0-rc.1");
	});

	it("falls back to AI_AGENT when CLAUDE_CODE_EXECPATH carries no version (e.g. npm install)", () => {
		expect(
			resolveClaudeCodeVersion({
				CLAUDE_CODE_EXECPATH: "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
				AI_AGENT: "claude-code_2-1-150_agent",
			}),
		).toBe("2.1.150");
	});

	it("normalizes the dashed AI_AGENT version to dotted form", () => {
		expect(resolveClaudeCodeVersion({ AI_AGENT: "claude-code_2-1-150_agent" })).toBe("2.1.150");
	});

	it("accepts a dotted AI_AGENT version", () => {
		expect(resolveClaudeCodeVersion({ AI_AGENT: "claude-code_2.1.150" })).toBe("2.1.150");
	});

	it("prefers CLAUDE_CODE_EXECPATH over AI_AGENT", () => {
		expect(
			resolveClaudeCodeVersion({
				CLAUDE_CODE_EXECPATH: "/opt/claude/versions/3.0.0",
				AI_AGENT: "claude-code_2-1-150_agent",
			}),
		).toBe("3.0.0");
	});

	it("returns undefined when no version source is present", () => {
		expect(resolveClaudeCodeVersion({})).toBeUndefined();
	});

	it("returns undefined when AI_AGENT is for a different runtime", () => {
		expect(resolveClaudeCodeVersion({ AI_AGENT: "some-other-agent_1-2-3" })).toBeUndefined();
	});
});
