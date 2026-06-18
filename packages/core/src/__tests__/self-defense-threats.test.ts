import { beforeAll, describe, expect, it } from "vitest";
import type { HeuristicsEngine } from "../heuristics.js";
import { createMatcher, loadEngine } from "./test-helper.js";

const matchCommand = createMatcher("command");
const matchFilePath = createMatcher("file_path");
const matchContent = createMatcher("content");

describe("Self-defense threats", () => {
	let engine: HeuristicsEngine;

	beforeAll(async () => {
		engine = await loadEngine();
	});

	// --- Delete .sage directory (SELF-001) ---

	it("detects rm -rf .sage (SELF-001)", () => {
		expect(matchCommand(engine, "rm -rf /home/user/.sage")).toContain("CLT-SELF-001");
	});

	it("detects del .sage (SELF-001)", () => {
		expect(matchCommand(engine, "del C:\\Users\\user\\.sage\\config.json")).toContain(
			"CLT-SELF-001",
		);
	});

	it("detects Remove-Item .sage (SELF-001)", () => {
		expect(matchCommand(engine, "Remove-Item -Recurse .sage")).toContain("CLT-SELF-001");
	});

	it("does not match unrelated rm (SELF-001)", () => {
		const ids = matchCommand(engine, "rm -rf node_modules");
		expect(ids.filter((id) => id === "CLT-SELF-001")).toEqual([]);
	});

	// --- Write to Sage config files (SELF-002) ---

	it("detects write to .sage/config.json (SELF-002)", () => {
		expect(matchFilePath(engine, "/home/user/.sage/config.json")).toContain("CLT-SELF-002");
	});

	it("does not match .sage/cache.json (SELF-002)", () => {
		const ids = matchFilePath(engine, "/home/user/.sage/cache.json");
		expect(ids.filter((id) => id === "CLT-SELF-002")).toEqual([]);
	});

	// --- Delete Claude Code hooks/plugins (SELF-003) ---

	it("detects rm .claude hooks.json (SELF-003)", () => {
		expect(matchCommand(engine, "rm /home/user/.claude/hooks.json")).toContain("CLT-SELF-003");
	});

	it("detects del .claude installed_plugins (SELF-003)", () => {
		expect(matchCommand(engine, "del C:\\Users\\user\\.claude\\installed_plugins")).toContain(
			"CLT-SELF-003",
		);
	});

	it("does not match reading .claude files (SELF-003)", () => {
		const ids = matchCommand(engine, "cat /home/user/.claude/hooks.json");
		expect(ids.filter((id) => id === "CLT-SELF-003")).toEqual([]);
	});

	// --- Disable Sage features via config (SELF-004) ---

	it("detects heuristics_enabled false (SELF-004)", () => {
		expect(matchContent(engine, '{"heuristics_enabled": false}')).toContain("CLT-SELF-004");
	});

	it("detects url_check enabled false (SELF-004)", () => {
		expect(matchContent(engine, '{"url_check": {"enabled": false}}')).toContain("CLT-SELF-004");
	});

	it("does not match heuristics_enabled true (SELF-004)", () => {
		const ids = matchContent(engine, '{"heuristics_enabled": true}');
		expect(ids.filter((id) => id === "CLT-SELF-004")).toEqual([]);
	});
});
