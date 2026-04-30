import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchModelManifest } from "../clients/model-manifest.js";

const IID = "550e8400-e29b-41d4-a716-446655440000";

describe("fetchModelManifest", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	});

	function mockFetch(impl: typeof fetch): void {
		globalThis.fetch = impl as typeof globalThis.fetch;
	}

	it("returns parsed manifest on a well-formed response", async () => {
		mockFetch(
			async () =>
				new Response(
					JSON.stringify({
						schema: "v1",
						models: {
							"pi-model": {
								url: "https://example.com/pi-model-v1.tar.gz",
								sha256: "abc",
							},
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		);

		const result = await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "claude-code",
		});
		expect(result).toEqual({
			schema: "v1",
			models: {
				"pi-model": { url: "https://example.com/pi-model-v1.tar.gz", sha256: "abc" },
			},
		});
	});

	it("includes the standard envelope plus a models.schema field in the request body", async () => {
		let capturedBody: unknown = null;
		mockFetch(async (_url, init) => {
			capturedBody = init?.body ? JSON.parse(String(init.body)) : null;
			return new Response(JSON.stringify({ schema: "v1", models: {} }), { status: 200 });
		});

		await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "claude-code",
			agentRuntimeVersion: "1.2.3",
			versionApp: "0.8.0",
		});

		const body = capturedBody as Record<string, unknown>;
		expect(body).toBeTruthy();
		expect(body.identity).toEqual({ uuid: IID });
		expect(body.product).toMatchObject({ version_app: "0.8.0" });
		expect(body.agent).toMatchObject({ agent_runtime: "claude-code" });
		expect(body.models).toEqual({ schema: "v1" });
	});

	it("returns null on HTTP error", async () => {
		mockFetch(async () => new Response("nope", { status: 502 }));
		const result = await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "cursor",
		});
		expect(result).toBeNull();
	});

	it("returns null on a malformed response (missing models)", async () => {
		mockFetch(async () => new Response(JSON.stringify({ schema: "v1" }), { status: 200 }));
		const result = await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "cursor",
		});
		expect(result).toBeNull();
	});

	it("returns null on a schema mismatch", async () => {
		mockFetch(
			async () => new Response(JSON.stringify({ schema: "v2", models: {} }), { status: 200 }),
		);
		const result = await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "cursor",
		});
		expect(result).toBeNull();
	});

	it("skips entries missing sha256 (and keeps the rest)", async () => {
		mockFetch(
			async () =>
				new Response(
					JSON.stringify({
						schema: "v1",
						models: {
							good: { url: "https://example.com/good.tar.gz", sha256: "abc" },
							bad: { url: "https://example.com/bad.tar.gz" },
						},
					}),
					{ status: 200 },
				),
		);
		const result = await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "cursor",
		});
		expect(result?.models).toEqual({
			good: { url: "https://example.com/good.tar.gz", sha256: "abc" },
		});
	});

	it("returns null when iid is empty", async () => {
		const result = await fetchModelManifest({
			iid: "",
			schema: "v1",
			agentRuntime: "cursor",
		});
		expect(result).toBeNull();
	});

	it("returns null when fetch throws", async () => {
		mockFetch(async () => {
			throw new Error("network down");
		});
		const result = await fetchModelManifest({
			iid: IID,
			schema: "v1",
			agentRuntime: "cursor",
		});
		expect(result).toBeNull();
	});
});
