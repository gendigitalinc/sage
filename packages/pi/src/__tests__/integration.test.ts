/**
 * Layer 1 integration tests for the Sage pi connector.
 *
 * Loads the built `dist/index.cjs` bundle (not source imports), registers it
 * on a mock pi `ExtensionAPI`, and drives the captured `tool_call` handler
 * through the real @gendigital/sage-core pipeline: real extractors,
 * heuristics, and YAML threats. Verdicts come from the canary rules in
 * `threats/dummy.yaml`; network and AMSI checks are disabled in an isolated
 * HOME so results are deterministic.
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
const EXTENSION_DIST = resolve(__dirname, "..", "..", "dist", "index.cjs");

const { cmdDenyAlpha, fileDeny, fileAsk, contentDeny } = CANARY_MARKERS;

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
			confirm: vi.fn(async () => opts.confirm ?? false),
			setStatus: vi.fn(),
		},
		sessionManager: { getSessionId: () => "pi-integration-session" },
	};
}

function loadHandler(): ToolCallHandler {
	// The bundle's CommonJS export is the extension factory itself.
	const factory = require(EXTENSION_DIST);
	let handler: ToolCallHandler | undefined;
	factory({
		on(event: string, h: ToolCallHandler) {
			if (event === "tool_call") handler = h;
		},
	});
	if (!handler) throw new Error("tool_call handler was not registered");
	return handler;
}

describe("pi integration: Sage extension pipeline", { timeout: 30_000 }, () => {
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
		tmpHome = await mkdtemp(resolve(tmpdir(), "sage-pi-integration-"));
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
		it("blocks canary bash and powershell commands", async () => {
			await expectBlocked("bash", { command: `echo ${cmdDenyAlpha}` });
			await expectBlocked("powershell", { command: `Write-Output ${cmdDenyAlpha}` });
		});

		it("blocks a write to a canary path", async () => {
			await expectBlocked("write", { path: `/tmp/${fileDeny}`, content: "x" });
		});

		it("blocks an edit inserting canary content", async () => {
			await expectBlocked("edit", {
				path: "src/a.ts",
				edits: [{ oldText: "a", newText: contentDeny }],
			});
		});

		it("blocks an edit whose removed text carries canary content", async () => {
			await expectBlocked("edit", {
				path: "src/a.ts",
				edits: [{ oldText: contentDeny, newText: "b" }],
			});
		});

		it("blocks a read of a canary path", async () => {
			await expectBlocked("read", { path: `/tmp/${fileDeny}` });
		});

		it("allows benign calls and unknown tools", async () => {
			const ctx = makeCtx();
			expect(await call("bash", { command: "ls -la" }, ctx)).toBeUndefined();
			expect(await call("read", { path: "/tmp/readme.md" }, ctx)).toBeUndefined();
			expect(await call("grep", { pattern: cmdDenyAlpha }, ctx)).toBeUndefined();
			expect(ctx.ui.confirm).not.toHaveBeenCalled();
		});
	});

	describe("ask verdicts", () => {
		const askPath = `src/${fileAsk}.ts`;

		it("prompts once, then honors the approval for an identical retry", async () => {
			const input = { path: askPath, edits: [{ oldText: "a", newText: "b" }] };
			const ctx = makeCtx({ confirm: true });
			expect(await call("edit", input, ctx)).toBeUndefined();
			expect(await call("edit", input, ctx)).toBeUndefined();
			expect(ctx.ui.confirm).toHaveBeenCalledTimes(1);
		});

		it("does not let an approval cover a different call that normalizes the same", async () => {
			// `oldText` is not part of the normalized toolInput; only the raw input
			// tells these two edits apart.
			const ctx = makeCtx({ confirm: true });
			await call("edit", { path: askPath, edits: [{ oldText: "x", newText: "Y" }] }, ctx);
			await call("edit", { path: askPath, edits: [{ oldText: "z", newText: "Y" }] }, ctx);
			expect(ctx.ui.confirm).toHaveBeenCalledTimes(2);
		});

		it("blocks when the user declines", async () => {
			const result = await call("write", { path: `/tmp/${fileAsk}-no`, content: "x" }, makeCtx());
			expect(result).toMatchObject({ block: true, reason: expect.stringContaining("User denied") });
		});

		it("blocks without prompting when no UI is attached", async () => {
			const ctx = makeCtx({ hasUI: false });
			const result = await call("write", { path: `/tmp/${fileAsk}-noui`, content: "x" }, ctx);
			expect(result).toMatchObject({ block: true });
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
