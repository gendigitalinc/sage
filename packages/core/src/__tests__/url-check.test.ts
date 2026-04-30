import { afterEach, describe, expect, it, vi } from "vitest";
import { UrlCheckClient } from "../clients/url-check.js";

describe("UrlCheckClient", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns empty for empty URL list", async () => {
		const client = new UrlCheckClient();
		const results = await client.checkUrls([]);
		expect(results).toEqual([]);
	});

	it("parses malicious URL response", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				answers: [
					{
						key: "http://malware.test",
						result: {
							success: {
								classification: {
									"detection-infos": [
										{
											name: "URL:Blacklist|UREA43C8218975956A-0200|urlb",
											finding: "malware",
											source: "viruslab-unified",
										},
									],
									result: {
										malicious: {
											findings: [
												{
													"severity-name": "malware",
													"type-name": "trojan",
												},
											],
										},
									},
								},
							},
						},
					},
				],
			}),
		});

		const client = new UrlCheckClient();
		const results = await client.checkUrls(["http://malware.test"]);
		expect(results).toHaveLength(1);
		expect(results[0]?.isMalicious).toBe(true);
		expect(results[0]?.detections).toStrictEqual(["URL:Blacklist|UREA43C8218975956A-0200|urlb"]);
		expect(results[0]?.findings).toHaveLength(1);
		expect(results[0]?.findings[0]?.severityName).toBe("malware");
	});

	it("parses clean URL response", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				answers: [
					{
						key: "http://safe.test",
						result: {
							success: {
								classification: {
									result: {},
								},
							},
						},
					},
				],
			}),
		});

		const client = new UrlCheckClient();
		const results = await client.checkUrls(["http://safe.test"]);
		expect(results).toHaveLength(1);
		expect(results[0]?.isMalicious).toBe(false);
		expect(results[0]?.findings).toHaveLength(0);
	});

	it("preserves query parameters when sending to API", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ answers: [] }),
		});
		globalThis.fetch = mockFetch;

		const client = new UrlCheckClient();
		await client.checkUrls(["http://safe.test?secret=token", "http://other.test/path?key=val"]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.queries[0].key["url-like"]).toBe("http://safe.test?secret=token");
		expect(body.queries[1].key["url-like"]).toBe("http://other.test/path?key=val");
	});

	it("does not surface backend `flags` on parsed result", async () => {
		// The backend may continue sending `success.flags` (typosquatting indicators, etc.),
		// but the client must not propagate it into UrlCheckResult — flags were never
		// intended as a user-facing signal and are no longer part of the type.
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				answers: [
					{
						key: "http://suspicious.test",
						result: {
							success: {
								classification: { result: {} },
								flags: ["TYPOSQUATTING"],
							},
						},
					},
				],
			}),
		});

		const client = new UrlCheckClient();
		const results = await client.checkUrls(["http://suspicious.test"]);
		expect(results).toHaveLength(1);
		expect(results[0]?.isMalicious).toBe(false);
		expect((results[0] as unknown as { flags?: unknown }).flags).toBeUndefined();
	});

	it("returns empty on fetch error (fail-open)", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));

		const client = new UrlCheckClient();
		const results = await client.checkUrls(["http://any.test"]);
		expect(results).toEqual([]);
	});

	it("returns empty on non-ok response (fail-open)", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		});

		const client = new UrlCheckClient();
		const results = await client.checkUrls(["http://any.test"]);
		expect(results).toEqual([]);
	});

	it("sends request payload with kebab-case field names", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ answers: [] }),
		});
		globalThis.fetch = mockFetch;

		const client = new UrlCheckClient();
		await client.checkUrls(["http://example.test"]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const body = JSON.parse(mockFetch.mock.calls[0][1].body);

		// Backend uses #[serde(rename_all = "kebab-case")] — snake_case fields are silently ignored.
		expect(body).toHaveProperty("client-info");
		expect(body["client-info"]).toHaveProperty("product-name");
		expect(body["client-info"]).toHaveProperty("product-version");
		expect(body).not.toHaveProperty("client_info");
	});

	it("requests detection-infos so the detection name is returned", async () => {
		// Without `include: { "detection-infos": true }` the upstream omits the
		// `detection-infos` array, so detection names like
		// "URL:Phishing|UR80DB9FCAE91E5845-0200|urlb" never reach the client and
		// downstream telemetry/audit logs end up with empty `signals.url_checks`.
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ answers: [] }),
		});
		globalThis.fetch = mockFetch;

		const client = new UrlCheckClient();
		await client.checkUrls(["http://example.test"]);

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.queries[0].include).toStrictEqual({ "detection-infos": true });
	});

	it("batches URLs in groups of 50", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ answers: [] }),
		});
		globalThis.fetch = mockFetch;

		const urls = Array.from({ length: 120 }, (_, i) => `http://url${i}.test`);
		const client = new UrlCheckClient();
		await client.checkUrls(urls);

		// 120 URLs → 3 batches (50, 50, 20)
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});
});
