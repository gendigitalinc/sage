import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultBranding } from "../brands.js";
import { loadConfig, resolvePath } from "../config.js";
import {
	formatConfigurationWarnings,
	getConfigurationWarnings,
	getConfigurationWarningsSync,
} from "../config-diagnostics.js";
import { makeTmpDir, withHomeOverride } from "./test-utils.js";

describe("resolvePath", () => {
	it("expands ~ prefix", () => {
		const resolved = resolvePath("~/foo/bar");
		expect(resolved).not.toContain("~");
		expect(resolved).toContain(join("foo", "bar"));
	});

	it("prefers HOME env when expanding ~", () => {
		const prevHome = process.env.HOME;
		const fakeHome = join(homedir(), "sage-home-override-test");
		try {
			process.env.HOME = fakeHome;
			expect(resolvePath("~/foo/bar")).toBe(join(fakeHome, "foo", "bar"));
		} finally {
			if (prevHome === undefined) {
				delete process.env.HOME;
			} else {
				process.env.HOME = prevHome;
			}
		}
	});

	it("leaves absolute paths unchanged", () => {
		expect(resolvePath("/absolute/path")).toBe("/absolute/path");
	});
});

describe("loadConfig", () => {
	it("returns defaults for missing file", async () => {
		const config = await loadConfig("/nonexistent/config.json");
		expect(config.sensitivity).toBe("balanced");
		expect(config.heuristics_enabled).toBe(true);
		expect(config.url_check.enabled).toBe(true);
		expect(config.url_check.timeout_seconds).toBe(5.0);
		expect(config.cache.enabled).toBe(true);
		expect(config.cache.ttl_malicious_seconds).toBe(3600);
		expect(config.cache.ttl_clean_seconds).toBe(86400);
	});

	it("loads valid config", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				sensitivity: "paranoid",
				heuristics_enabled: false,
				url_check: { timeout_seconds: 10 },
			}),
		);
		const config = await loadConfig(configPath);
		expect(config.sensitivity).toBe("paranoid");
		expect(config.heuristics_enabled).toBe(false);
		expect(config.url_check.timeout_seconds).toBe(10);
		// Defaults preserved for unset fields
		expect(config.url_check.enabled).toBe(true);
		expect(config.cache.enabled).toBe(true);
	});

	it("loads valid config from a tilde-prefixed path", async () => {
		const dir = await makeTmpDir();
		const home = withHomeOverride(dir);
		try {
			const sageDir = join(dir, ".sage");
			await mkdir(sageDir, { recursive: true });
			await writeFile(
				join(sageDir, "config.json"),
				JSON.stringify({ sensitivity: "paranoid", heuristics_enabled: false }),
			);

			const config = await loadConfig("~/.sage/config.json");
			expect(config.sensitivity).toBe("paranoid");
			expect(config.heuristics_enabled).toBe(false);
		} finally {
			home.restore();
		}
	});

	it("returns defaults for malformed JSON", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(configPath, "not json");
		const config = await loadConfig(configPath);
		expect(config.sensitivity).toBe("balanced");
	});

	it("returns defaults for non-object JSON", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(configPath, JSON.stringify([1, 2, 3]));
		const config = await loadConfig(configPath);
		expect(config.sensitivity).toBe("balanced");
	});

	it("defaults disabled_threats to empty array when missing", async () => {
		const config = await loadConfig("/nonexistent/config.json");
		expect(config.disabled_threats).toEqual([]);
	});

	it("parses disabled_threats string array", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({ disabled_threats: ["CLT-CMD-001", "CLT-CMD-002"] }),
		);
		const config = await loadConfig(configPath);
		expect(config.disabled_threats).toEqual(["CLT-CMD-001", "CLT-CMD-002"]);
	});

	it("anchors relative state file paths under ~/.sage", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				cache: { path: "cache-local.json" },
				allowlist: { path: "allowlists/main.json" },
				logging: { path: "logs/audit.jsonl" },
				operational_logging: { path: "logs/operational.jsonl" },
			}),
		);
		const config = await loadConfig(configPath);
		const sageDir = join(homedir(), ".sage");
		expect(config.cache.path).toBe(resolve(sageDir, "cache-local.json"));
		expect(config.allowlist.path).toBe(resolve(sageDir, "allowlists/main.json"));
		expect(config.logging.path).toBe(resolve(sageDir, "logs/audit.jsonl"));
		expect(config.operational_logging.path).toBe(resolve(sageDir, "logs/operational.jsonl"));
	});

	it("accepts explicit ~/.sage paths", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				cache: { path: "~/.sage/cache-custom.json" },
				allowlist: { path: "~/.sage/allowlist-custom.json" },
				logging: { path: "~/.sage/audit-custom.jsonl" },
				operational_logging: { path: "~/.sage/log-custom.jsonl" },
			}),
		);
		const config = await loadConfig(configPath);
		const sageDir = join(homedir(), ".sage");
		expect(config.cache.path).toBe(resolve(sageDir, "cache-custom.json"));
		expect(config.allowlist.path).toBe(resolve(sageDir, "allowlist-custom.json"));
		expect(config.logging.path).toBe(resolve(sageDir, "audit-custom.jsonl"));
		expect(config.operational_logging.path).toBe(resolve(sageDir, "log-custom.jsonl"));
	});

	it("accepts in-tree paths whose segment names start with '..'", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				cache: { path: "~/.sage/..data/cache.json" },
				allowlist: { path: "~/.sage/..cfg/allowlist.json" },
				logging: { path: "~/.sage/..logs/audit.jsonl" },
				operational_logging: { path: "~/.sage/..logs/operational.jsonl" },
			}),
		);
		const config = await loadConfig(configPath);
		const sageDir = join(homedir(), ".sage");
		expect(config.cache.path).toBe(resolve(sageDir, "..data/cache.json"));
		expect(config.allowlist.path).toBe(resolve(sageDir, "..cfg/allowlist.json"));
		expect(config.logging.path).toBe(resolve(sageDir, "..logs/audit.jsonl"));
		expect(config.operational_logging.path).toBe(resolve(sageDir, "..logs/operational.jsonl"));
	});

	it("falls back to defaults when state file paths escape ~/.sage", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		const outsideAbsolute = resolve(homedir(), "..", "evil-allowlist.json");
		await writeFile(
			configPath,
			JSON.stringify({
				cache: { path: "~/../../../tmp/evil-cache.json" },
				allowlist: { path: outsideAbsolute },
				logging: { path: "../evil-audit.jsonl" },
				operational_logging: { path: "../evil-operational.jsonl" },
			}),
		);
		const config = await loadConfig(configPath);
		const sageDir = join(homedir(), ".sage");
		expect(config.cache.path).toBe(resolve(sageDir, "cache.json"));
		expect(config.allowlist.path).toBe(resolve(sageDir, "allowlist.json"));
		expect(config.logging.path).toBe(resolve(sageDir, "audit.jsonl"));
		expect(config.operational_logging.path).toBe(resolve(sageDir, "operational.jsonl"));
	});

	it("falls back when state file paths resolve to ~/.sage directory", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				cache: { path: "." },
				allowlist: { path: "   " },
				logging: { path: "~/.sage/" },
				operational_logging: { path: "~/.sage/" },
			}),
		);
		const config = await loadConfig(configPath);
		const sageDir = join(homedir(), ".sage");
		expect(config.cache.path).toBe(resolve(sageDir, "cache.json"));
		expect(config.allowlist.path).toBe(resolve(sageDir, "allowlist.json"));
		expect(config.logging.path).toBe(resolve(sageDir, "audit.jsonl"));
		expect(config.operational_logging.path).toBe(resolve(sageDir, "operational.jsonl"));
	});
});

describe("configuration diagnostics", () => {
	it("reports malformed config JSON with a branded user-facing warning", async () => {
		const dir = await makeTmpDir();
		const configPath = join(dir, "config.json");
		await writeFile(configPath, "not json");

		const warnings = await getConfigurationWarnings(configPath);
		expect(warnings).toEqual([{ file: "config", path: configPath, reason: "parse" }]);

		const message = formatConfigurationWarnings(warnings, defaultBranding);
		expect(message).toContain("Sage: configuration warning");
		expect(message).toContain("config.json");
		expect(message).toContain("not valid JSON");
	});

	it("reports malformed exceptions JSON", async () => {
		const dir = await makeTmpDir();
		const home = withHomeOverride(dir);
		try {
			const sageDir = join(dir, ".sage");
			await mkdir(sageDir, { recursive: true });
			const configPath = join(sageDir, "config.json");
			const exceptionsPath = join(sageDir, "exceptions.json");
			await writeFile(configPath, JSON.stringify({}));
			await writeFile(exceptionsPath, "not json");

			const warnings = await getConfigurationWarnings(configPath);
			expect(warnings).toEqual([{ file: "exceptions", path: exceptionsPath, reason: "parse" }]);
		} finally {
			home.restore();
		}
	});

	it("reports exceptions files with the wrong shape", async () => {
		const dir = await makeTmpDir();
		const home = withHomeOverride(dir);
		try {
			const sageDir = join(dir, ".sage");
			await mkdir(sageDir, { recursive: true });
			const configPath = join(sageDir, "config.json");
			const exceptionsPath = join(sageDir, "exceptions.json");
			await writeFile(configPath, JSON.stringify({}));
			await writeFile(
				exceptionsPath,
				JSON.stringify([{ decision: "allow", match: "regex", pattern: "^jira\\s+" }]),
			);

			const warnings = await getConfigurationWarnings(configPath);
			expect(warnings).toEqual([
				{ file: "exceptions", path: exceptionsPath, reason: "validation" },
			]);

			const message = formatConfigurationWarnings(warnings, defaultBranding);
			expect(message).toContain("wrong shape");
			expect(message).toContain('"rules":[]');
		} finally {
			home.restore();
		}
	});

	it("uses the resolved config path when checking exceptions diagnostics", async () => {
		const dir = await makeTmpDir();
		const home = withHomeOverride(dir);
		try {
			const sageDir = join(dir, ".sage");
			await mkdir(sageDir, { recursive: true });
			const exceptionsPath = join(sageDir, "custom-exceptions.json");
			await writeFile(
				join(sageDir, "config.json"),
				JSON.stringify({ exceptions: { path: "custom-exceptions.json" } }),
			);
			await writeFile(exceptionsPath, "not json");

			const expected = [{ file: "exceptions", path: exceptionsPath, reason: "parse" }];
			await expect(getConfigurationWarnings("~/.sage/config.json")).resolves.toEqual(expected);
			expect(getConfigurationWarningsSync("~/.sage/config.json")).toEqual(expected);
		} finally {
			home.restore();
		}
	});
});
