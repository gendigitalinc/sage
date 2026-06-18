import { describe, expect, it, vi } from "vitest";
import plugin from "../index.js";

vi.mock("@gendigital/sage-core", () => ({
	ApprovalStore: class {
		cleanup() {}
	},
	checkAllowlistMigration: vi.fn(() => Promise.resolve({ needed: false, entryTypes: [] })),
	createOperationalLogger: vi.fn(() => ({
		forComponent: vi.fn(() => ({
			debug() {},
			info() {},
			warn() {},
			error() {},
		})),
	})),
	formatAllowlistMigrationWarning: vi.fn(() => "allowlist migration warning"),
	formatConfigurationWarnings: vi.fn(() => "config warnings"),
	getConfigurationWarningsSync: vi.fn(() => []),
	loadConfigSync: vi.fn(() => ({})),
	resolveBranding: vi.fn(() => ({ name: "Sage" })),
}));

vi.mock("../bundled-dirs.js", () => ({
	getBundledDataDirs: vi.fn(() => ({
		threatsDir: "/threats",
		trustedDomainsDir: "/trusted-domains",
	})),
}));

vi.mock("../startup-scan.js", () => ({
	createBeforeAgentStartHandler: vi.fn(
		(getFindings: () => string | null, clearFindings: () => void) => () => {
			const findings = getFindings();
			if (!findings) return undefined;
			clearFindings();
			return { prependContext: findings };
		},
	),
	createSessionScanHandler: vi.fn(
		(_logger: unknown, _branding: unknown, onResult?: (msg: string) => void) => () => {
			onResult?.("session scan");
		},
	),
	createStartupScanHandler: vi.fn(
		(_logger: unknown, _branding: unknown, onResult?: (msg: string) => void) => () => {
			onResult?.("startup scan");
		},
	),
}));

vi.mock("../tool-handler.js", () => ({
	createToolCallHandler: vi.fn(() => vi.fn()),
}));

type Handler = () => unknown;

function createMockApi() {
	const handlers = new Map<string, Handler>();
	return {
		handlers,
		api: {
			logger: {
				debug() {},
				info() {},
				warn() {},
				error() {},
			},
			on(event: string, handler: Handler) {
				handlers.set(event, handler);
			},
		},
	};
}

describe("OpenClaw plugin registration", () => {
	it("keeps configuration warnings while replacing stale scan findings", async () => {
		const { api, handlers } = createMockApi();
		plugin.register(api);

		handlers.get("gateway_start")?.();
		handlers.get("session_start")?.();

		const result = await handlers.get("before_agent_start")?.();
		expect(result).toEqual({ prependContext: "config warnings\n\nsession scan" });

		const secondResult = await handlers.get("before_agent_start")?.();
		expect(secondResult).toBeUndefined();
	});
});
