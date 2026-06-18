import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateToolCall } from "../evaluator.js";
import { createOperationalLogger } from "../operational-log.js";
import type { OperationalLoggingConfig } from "../types.js";
import { makeTmpDir, withHomeOverride } from "./test-utils.js";

function makeConfig(dir: string, overrides: Partial<OperationalLoggingConfig> = {}) {
	return {
		enabled: true,
		level: "info" as const,
		path: join(dir, "operational.jsonl"),
		max_bytes: 5 * 1024 * 1024,
		max_files: 3,
		...overrides,
	};
}

async function readEntries(path: string): Promise<Record<string, unknown>[]> {
	const content = await readFile(path, "utf8");
	return content
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function waitForFile(path: string): Promise<void> {
	for (let i = 0; i < 20; i++) {
		try {
			await stat(path);
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
	}
	throw new Error(`Timed out waiting for ${path}`);
}

async function waitForEntries(
	path: string,
	predicate: (entries: Record<string, unknown>[]) => boolean,
): Promise<Record<string, unknown>[]> {
	for (let i = 0; i < 20; i++) {
		try {
			const entries = await readEntries(path);
			if (predicate(entries)) return entries;
		} catch {
			// File may not exist yet.
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	return readEntries(path);
}

describe("operational log", () => {
	it("writes JSONL entries with structured fields", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir);
		const logger = createOperationalLogger(config, "cursor").forComponent("evaluator");

		logger.info("Tool call evaluation started", { toolName: "Bash" });
		await logger.flush?.();

		const [entry] = await readEntries(config.path);
		expect(entry).toMatchObject({
			level: "info",
			runtime: "cursor",
			component: "evaluator",
			message: "Tool call evaluation started",
			data: { toolName: "Bash" },
		});
		expect(entry?.timestamp).toEqual(expect.any(String));
	});

	it("filters entries below configured level", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir, { level: "warn" });
		const logger = createOperationalLogger(config, "vscode").forComponent("telemetry");

		logger.debug("debug skipped");
		logger.error("error written");
		await logger.flush?.();

		const entries = await readEntries(config.path);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.message).toBe("error written");
	});

	it("does not write when disabled", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir, { enabled: false });
		const logger = createOperationalLogger(config, "openclaw").forComponent("tool-handler");

		logger.error("disabled");
		await logger.flush?.();

		await expect(stat(config.path)).rejects.toThrow();
	});

	it("rotates with audit-log-style numbered backups", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir, { max_bytes: 1, max_files: 1 });
		const logger = createOperationalLogger(config, "opencode").forComponent("plugin");

		logger.info("first");
		await logger.flush?.();
		logger.info("second");
		await logger.flush?.();

		const active = await readEntries(config.path);
		const rotated = await readEntries(`${config.path}.1`);
		expect(active[0]?.message).toBe("second");
		expect(rotated[0]?.message).toBe("first");
	});

	it("keeps fresh operational entries active when several writes hit rotation together", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir, { level: "debug", max_bytes: 2_000, max_files: 3 });
		await writeFile(
			config.path,
			`${JSON.stringify({ message: "old logs", payload: "x".repeat(3_000) })}\n`,
		);
		const logger = createOperationalLogger(config, "cursor").forComponent("sage-hook");

		logger.debug("Cursor hook started");
		logger.debug("Tool call evaluation started");
		logger.debug("Tool call evaluation completed");
		logger.debug("Cursor hook completed");
		await logger.flush?.();

		const active = await readEntries(config.path);
		expect(active.map((entry) => entry.message)).toEqual([
			"Cursor hook started",
			"Tool call evaluation started",
			"Tool call evaluation completed",
			"Cursor hook completed",
		]);
		const rotated = await readEntries(`${config.path}.1`);
		expect(rotated[0]?.message).toBe("old logs");
		await expect(stat(`${config.path}.2`)).rejects.toThrow();
	});

	it("logger methods write runtime-bound entries and serialize data safely", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir, { level: "debug" });
		const logger = createOperationalLogger(config, "claude-code").forComponent("pre-tool-use");
		const circular: Record<string, unknown> = { toolName: "Bash" };
		circular.self = circular;

		logger.debug("normalized tool call", { circular });
		await waitForFile(config.path);

		const [entry] = await readEntries(config.path);
		expect(entry?.level).toBe("debug");
		expect(entry?.runtime).toBe("claude-code");
		expect(entry?.component).toBe("pre-tool-use");
		expect(entry?.message).toBe("normalized tool call");
		expect(entry?.data).toEqual({
			circular: { toolName: "Bash", self: "[Circular]" },
		});
	});

	it("flush waits for pending logger writes", async () => {
		const dir = await makeTmpDir();
		const config = makeConfig(dir);
		const logger = createOperationalLogger(config, "claude-code").forComponent("pre-tool-use");

		logger.info("flush me");
		await logger.flush?.();

		const [entry] = await readEntries(config.path);
		expect(entry?.message).toBe("flush me");
	});

	it("fails open when the log path cannot be written", async () => {
		const dir = await makeTmpDir();
		const parentFile = join(dir, "not-a-directory");
		await mkdir(dir, { recursive: true });
		const parentLogger = createOperationalLogger(
			makeConfig(dir, { path: parentFile }),
			"cursor",
		).forComponent("test");
		parentLogger.info("first creates parent file path");
		await parentLogger.flush?.();

		const logger = createOperationalLogger(
			makeConfig(dir, { path: join(parentFile, "operational.jsonl") }),
			"cursor",
		).forComponent("test");
		logger.info("should not throw");
		await expect(logger.flush?.()).resolves.toBeUndefined();
	});

	it("records evaluator deny diagnostics through a runtime-bound logger", async () => {
		const dir = await makeTmpDir();
		const env = withHomeOverride(dir);
		try {
			const sageDir = join(dir, ".sage");
			await mkdir(sageDir, { recursive: true });
			await writeFile(
				join(sageDir, "exceptions.json"),
				JSON.stringify({
					rules: [
						{
							decision: "deny",
							match: "regex",
							pattern: "blocked-command",
							reason: "test deny",
						},
					],
				}),
			);
			const config = makeConfig(sageDir, { level: "debug" });
			const logger = createOperationalLogger(config, "cursor").forComponent("evaluator-test");

			const verdict = await evaluateToolCall(
				{
					sessionId: "session-1",
					conversationId: "conversation-1",
					agentRuntime: "cursor",
					hookType: "PreToolUse",
					toolName: "Bash",
					toolInput: { command: "blocked-command" },
					artifacts: [{ type: "command", value: "blocked-command" }],
				},
				{
					threatsDir: join(dir, "threats"),
					trustedDomainsDir: join(dir, "trusted-domains"),
					logger,
				},
			);

			expect(verdict.decision).toBe("deny");
			const entries = await waitForEntries(
				config.path,
				(current) =>
					current.length >= 1 &&
					current.some((entry) => entry.message === "Tool call evaluation completed"),
			);
			expect(
				entries.some(
					(entry) =>
						entry.message === "Tool call evaluation completed" &&
						(entry.data as Record<string, unknown> | undefined)?.decision === "deny" &&
						(entry.data as Record<string, unknown> | undefined)?.toolName === "Bash" &&
						typeof (entry.data as Record<string, unknown> | undefined)?.eventId === "string",
				),
			).toBe(true);
		} finally {
			env.restore();
		}
	});
});
