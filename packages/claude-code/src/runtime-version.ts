/**
 * Resolve the running Claude Code version.
 *
 * Claude Code has no hook-input field carrying its own version, but it exports
 * env vars into the hook child process that encode it:
 *
 * - `CLAUDE_CODE_EXECPATH` — native installer layout, e.g.
 *   `~/.local/share/claude/versions/2.1.150` (the `/versions/<v>` segment is the
 *   authoritative version). Absent or version-less for npm/global installs.
 * - `AI_AGENT` — e.g. `claude-code_2-1-150_agent` (version segment uses dashes).
 *
 * Returns `undefined` when no source yields a parseable version, in which case
 * the caller falls back to `"unknown"`.
 */

const VERSIONS_DIR_RE = /[\\/]versions[\\/](\d+\.\d+\.\d+[^\\/]*)/;
const AI_AGENT_RE = /^claude-code[_-](\d+)[._-](\d+)[._-](\d+)/;

export function resolveClaudeCodeVersion(env: NodeJS.ProcessEnv = process.env): string | undefined {
	const execPath = env.CLAUDE_CODE_EXECPATH;
	if (execPath) {
		const match = execPath.match(VERSIONS_DIR_RE);
		if (match) {
			return match[1];
		}
	}

	const aiAgent = env.AI_AGENT;
	if (aiAgent) {
		const match = aiAgent.match(AI_AGENT_RE);
		if (match) {
			return `${match[1]}.${match[2]}.${match[3]}`;
		}
	}

	return undefined;
}
