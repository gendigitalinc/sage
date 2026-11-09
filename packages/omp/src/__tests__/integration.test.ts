/**
 * Layer 1 integration tests for the Sage Oh My Pi connector.
 *
 * Loads the built `dist/index.cjs` bundle (not source imports), registers it
 * on a mock OMP hook API, and drives the captured `tool_call` handler through
 * the real @gendigital/sage-core pipeline: real extractors, heuristics, and
 * YAML threats. Verdicts come from the canary rules in `threats/dummy.yaml`;
 * network and AMSI checks are disabled in an isolated HOME so results are
 * deterministic.
 *
 * Included in `pnpm test` (the global setup builds the bundle first).
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CANARY_MARKERS } from "@gendigital/sage-core/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const HOOK_DIST = resolve(__dirname, "..", "..", "dist", "index.cjs");

const { cmdDenyAlpha, fileDeny, fileAsk, contentDeny, urlDeny } = CANARY_MARKERS;

interface ToolCallResult {
	block?: boolean;
	reason?: string;
}
type Ctx = ReturnType<typeof makeCtx>;
type ToolCallHandler = (
	event: { toolName: string; toolCallId: string; input: Record<string, unknown> },
	ctx: Ctx,
) => Promise<ToolCallResult | undefined>;

function makeCtx(opts: { hasUI?: boolean; confirm?: boolean } = {}) {
	return {
		hasUI: opts.hasUI ?? true,
		ui: {
			// OMP 18.12: confirm(title, message) — the banner is the body.
			confirm: vi.fn(async (_title: string, _message: string) => opts.confirm ?? false),
			setStatus: vi.fn(),
		},
		sessionManager: { getSessionId: () => "omp-integration-session" },
	};
}

function loadHandler(): ToolCallHandler {
	// The bundle's CommonJS export is the hook factory itself.
	const factory = require(HOOK_DIST);
	let handler: ToolCallHandler | undefined;
	factory({
		logger: { debug() {}, info() {}, warn() {}, error() {} },
		on(event: string, h: ToolCallHandler) {
			if (event === "tool_call") handler = h;
		},
	});
	if (!handler) throw new Error("tool_call handler was not registered");
	return handler;
}

describe("OMP integration: Sage hook pipeline", { timeout: 30_000 }, () => {
	let handler: ToolCallHandler;
	let tmpHome = "";
	let origHome: string | undefined;
	let callSeq = 0;

	const call = (toolName: string, input: Record<string, unknown>, ctx: Ctx = makeCtx()) => {
		callSeq += 1;
		return handler({ toolName, toolCallId: `call-${callSeq}`, input }, ctx);
	};

	const expectBlocked = async (toolName: string, input: Record<string, unknown>) => {
		expect(await call(toolName, input)).toMatchObject({
			block: true,
			reason: expect.stringContaining("Sage"),
		});
	};

	beforeAll(async () => {
		origHome = process.env.HOME;
		tmpHome = await mkdtemp(resolve(tmpdir(), "sage-omp-integration-"));
		await mkdir(join(tmpHome, ".sage"), { recursive: true });
		const off = { enabled: false };
		await writeFile(
			join(tmpHome, ".sage", "config.json"),
			JSON.stringify({
				url_check: off,
				file_check: off,
				package_check: off,
				amsi_check: off,
				pi_check: off,
			}),
		);
		process.env.HOME = tmpHome;
		handler = loadHandler();
	});

	afterAll(async () => {
		if (origHome === undefined) delete process.env.HOME;
		else process.env.HOME = origHome;
		await rm(tmpHome, { recursive: true, force: true });
	});

	describe("tool coverage", () => {
		it("blocks a canary bash command", async () => {
			await expectBlocked("bash", { command: `echo ${cmdDenyAlpha}` });
		});

		it("blocks a canary eval cell", async () => {
			await expectBlocked("eval", { language: "py", code: `print("${cmdDenyAlpha}")` });
		});

		it("blocks a debug launch whose args carry a canary", async () => {
			await expectBlocked("debug", { action: "launch", program: "./app", args: [cmdDenyAlpha] });
		});

		it("blocks a write to a canary path", async () => {
			await expectBlocked("write", { path: `/tmp/${fileDeny}`, content: "x" });
		});

		it("blocks a read of a canary URL, including a collapsed scheme", async () => {
			await expectBlocked("read", { path: `https://${urlDeny}.test/x` });
			await expectBlocked("read", { path: `https:/${urlDeny}.test/x` });
		});

		it("blocks an ast_edit replacement template carrying canary content", async () => {
			await expectBlocked("ast_edit", {
				paths: ["src/a.ts"],
				ops: [{ pat: "foo()", out: contentDeny }],
			});
		});

		it("allows benign calls and unknown tools", async () => {
			const ctx = makeCtx();
			expect(await call("bash", { command: "ls -la" }, ctx)).toBeUndefined();
			expect(await call("read", { path: "/tmp/readme.md" }, ctx)).toBeUndefined();
			expect(await call("grep", { pattern: cmdDenyAlpha }, ctx)).toBeUndefined();
			expect(await call("debug", { action: "threads" }, ctx)).toBeUndefined();
			expect(ctx.ui.confirm).not.toHaveBeenCalled();
		});
	});

	describe("edit payloads OMP accepts leniently", () => {
		it.each([
			[
				"hashline in a Begin Patch envelope",
				`*** Begin Patch\n[${fileDeny}#ABCD]\nPUT >$:\n+x\n*** End Patch`,
			],
			[
				"sloppy in a Begin Patch envelope",
				`*** Begin Patch\n*** Edit File: ${fileDeny}\n*** Insert After\nx\n*** End Patch`,
			],
			[
				"lower-case sloppy header without a colon",
				`*** edit file ${fileDeny}\n*** insert after\nx`,
			],
			["hashline header with trailing whitespace", `[${fileDeny}#ABCD]   \nPUT >$:\n+x`],
			[
				"hashline header behind a bracketed envelope marker",
				`[*** Begin Patch] [${fileDeny}#ABCD]\nPUT >$:\n+x`,
			],
			[
				"sloppy target behind a decoy apply_patch header",
				`*** Update File: harmless.txt\n*** Edit File: ${fileDeny}\n*** Insert After\nx`,
			],
		])("blocks a canary target: %s", async (_label, input) => {
			await expectBlocked("edit", { input });
		});

		it("scans the patch text even when no target path parses", async () => {
			await expectBlocked("edit", { input: `PUT >$:\n+${contentDeny}\n` });
		});
	});

	describe("ask verdicts", () => {
		const askPath = `src/${fileAsk}.ts`;

		it("prompts once, then honors the approval for an identical retry", async () => {
			const input = { paths: [askPath], ops: [{ pat: "a()", out: "b()" }] };
			const ctx = makeCtx({ confirm: true });
			expect(await call("ast_edit", input, ctx)).toBeUndefined();
			expect(await call("ast_edit", input, ctx)).toBeUndefined();
			expect(ctx.ui.confirm).toHaveBeenCalledTimes(1);
			// confirm(title, message): a one-arg call would dump the banner into
			// the title and leave the dialog body empty.
			const [title, message] = ctx.ui.confirm.mock.calls[0] ?? [];
			expect(title).toMatch(/^🛡️ Sage:/);
			expect(message).toContain(askPath);
			expect(message).toContain("Requires confirmation");
			expect(ctx.ui.setStatus).toHaveBeenCalledWith("sage", expect.stringMatching(/Suspicious/));
		});

		it("does not let an approval cover a different call that normalizes the same", async () => {
			// Both normalize to { file_path: askPath, new_string: "Y" }; only the raw
			// input tells them apart.
			const ctx = makeCtx({ confirm: true });
			await call("ast_edit", { paths: [askPath], ops: [{ pat: "x()", out: "Y" }] }, ctx);
			await call(
				"ast_edit",
				{ paths: [askPath, "src/other.ts"], ops: [{ pat: "z", out: "Y" }] },
				ctx,
			);
			expect(ctx.ui.confirm).toHaveBeenCalledTimes(2);
		});

		it("blocks when the user declines", async () => {
			const result = await call("write", { path: `/tmp/${fileAsk}-no`, content: "x" }, makeCtx());
			expect(result).toMatchObject({
				block: true,
				reason: expect.stringContaining("The user explicitly declined"),
			});
			expect(result?.reason).toContain("Do not retry this tool call");
		});

		it("blocks without prompting when no UI is attached", async () => {
			const ctx = makeCtx({ hasUI: false });
			const result = await call("write", { path: `/tmp/${fileAsk}-noui`, content: "x" }, ctx);
			expect(result).toMatchObject({
				block: true,
				reason: expect.stringContaining("No interactive UI is attached"),
			});
			expect(result?.reason).toContain("This is not a user decision.");
			expect(result?.reason).not.toContain("declined");
			expect(ctx.ui.confirm).not.toHaveBeenCalled();
		});

		it("still prompts when the status backend throws", async () => {
			const ctx = makeCtx({ confirm: true });
			ctx.ui.setStatus.mockImplementation(() => {
				throw new Error("status backend down");
			});
			const result = await call("write", { path: `/tmp/${fileAsk}-status`, content: "x" }, ctx);
			expect(result).toBeUndefined();
			expect(ctx.ui.confirm).toHaveBeenCalledTimes(1);
		});
	});
});
