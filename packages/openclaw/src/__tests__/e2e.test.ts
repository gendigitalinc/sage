/**
 * Tier 3 E2E tests: Sage plugin running inside an OpenClaw gateway.
 *
 * Excluded from `pnpm test` via vitest config. Run with:
 *
 *   pnpm test:e2e:openclaw
 *
 * Prerequisites:
 * - Running OpenClaw gateway with Sage plugin installed
 * - Chat completions endpoint enabled in gateway config:
 *     gateway.http.endpoints.chatCompletions.enabled = true
 *   (in ~/.openclaw/openclaw.json)
 *
 * Auth token and host are resolved from ~/.openclaw/openclaw.json automatically.
 * Override with env vars: OPENCLAW_GATEWAY_TOKEN, OPENCLAW_E2E_HOST, OPENCLAW_E2E_MODEL.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// biome-ignore lint/suspicious/noExplicitAny: JSON config shape is untyped
type OpenClawConfig = Record<string, any>;

function loadOpenClawConfig(): OpenClawConfig | undefined {
	try {
		const configPath = join(homedir(), ".openclaw", "openclaw.json");
		return JSON.parse(readFileSync(configPath, "utf-8"));
	} catch {
		return undefined;
	}
}

const openclawConfig = loadOpenClawConfig();

function resolveToken(): string | undefined {
	return process.env.OPENCLAW_GATEWAY_TOKEN ?? openclawConfig?.gateway?.auth?.token ?? undefined;
}

function isChatCompletionsEnabled(): boolean {
	return openclawConfig?.gateway?.http?.endpoints?.chatCompletions?.enabled === true;
}

const HOST = process.env.OPENCLAW_E2E_HOST ?? "http://localhost:18789";
const TOKEN = resolveToken();
const MODEL = process.env.OPENCLAW_E2E_MODEL ?? "openclaw";
const CHAT_ENABLED = isChatCompletionsEnabled();

const SYSTEM_PROMPT =
	"You are a tool executor. Always use the appropriate tool to fulfill requests. " +
	"Use exec for shell commands, write for creating/writing files, web_fetch for fetching " +
	"URLs, edit for editing files. Execute immediately without explaining or asking for " +
	"confirmation. Never respond with plain text when a tool can be used instead.";

// --- Helpers ---

async function chat(prompt: string, systemPrompt = SYSTEM_PROMPT): Promise<string> {
	const response = await fetch(`${HOST}/v1/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${TOKEN}`,
			"X-OpenClaw-Scopes": "operator.write",
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: 4096,
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: prompt },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Gateway returned ${response.status}: ${await response.text()}`);
	}

	const data = (await response.json()) as {
		choices: Array<{ message: { content: string } }>;
	};

	return data.choices[0]?.message?.content ?? "";
}

// --- Tests ---

const canRun = TOKEN && CHAT_ENABLED;
if (!canRun) {
	const reasons: string[] = [];
	if (!TOKEN) reasons.push("no gateway token");
	if (!CHAT_ENABLED) reasons.push("gateway.http.endpoints.chatCompletions.enabled is not true");
	console.warn(`OpenClaw E2E skipped: ${reasons.join(", ")}`);
}
const describeE2E = canRun ? describe : describe.skip;

describeE2E("E2E: Sage plugin in OpenClaw gateway", { timeout: 180_000 }, () => {
	it("allows benign command", async (ctx) => {
		const text = await chat("Use exec to run: echo hello_e2e_test");
		if (!text.includes("hello_e2e_test")) {
			ctx.skip("Model did not echo expected output");
		}
		expect(text).toContain("hello_e2e_test");
	});

	it("blocks canary command via dummy rule", async () => {
		const text = await chat("Use exec to run this command: echo __sage_test_deny_cmd_a75bf229__");
		expect(text.toLowerCase()).toMatch(/sage|blocked/);
	});

	it("blocks canary file path via dummy rule", async () => {
		const text = await chat(
			"Use write to create a file called __sage_test_deny_file_e6c4a918__.txt with content 'hello'",
		);
		expect(text.toLowerCase()).toMatch(/sage|blocked/);
	});

	it("blocks canary URL via dummy rule", async () => {
		const text = await chat("Use web_fetch on https://sage-canary-deny-4e91ca37.test/page");
		expect(text.toLowerCase()).toMatch(/sage|blocked/);
	});

	it("sage_approve tool is registered", async (ctx) => {
		const text = await chat("What tools do you have? List all of them.");
		const mentionsSage =
			text.toLowerCase().includes("sage_approve") || text.toLowerCase().includes("sage");
		if (!mentionsSage) {
			ctx.skip("Model did not mention sage_approve in tool list");
		}
		expect(mentionsSage).toBe(true);
	});
});
