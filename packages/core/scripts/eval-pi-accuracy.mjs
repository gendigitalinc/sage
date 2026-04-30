#!/usr/bin/env node
/**
 * Manual PI (prompt-injection) accuracy evaluation. Not part of `pnpm test` —
 * invoked via `pnpm eval:pi` from the repo root. Pure observability: loads
 * three fixtures, runs the bundled PI classifier over them, prints a per-suite
 * breakdown of deny / ask / miss verdicts. No assertions, no thresholds —
 * accuracy is reported, never gated on.
 *
 * Use this before/after model swaps, threshold tuning, or tokenizer
 * changes to see how detection shifts on real-world content.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const FIXTURES = resolve(PKG_ROOT, "src/__tests__/fixtures");
const PI_CHECK = pathToFileURL(resolve(PKG_ROOT, "dist/clients/pi-check.js")).href;
const TYPES = pathToFileURL(resolve(PKG_ROOT, "dist/types.js")).href;
const MODEL_STORAGE = pathToFileURL(resolve(PKG_ROOT, "dist/model-storage.js")).href;

const { getModelDir, isModelPresent, requiredModelFiles } = await import(MODEL_STORAGE);
const MODEL_PATH = getModelDir("pi-model");

if (!existsSync(MODEL_PATH) || !isModelPresent("pi-model")) {
	const missing = requiredModelFiles("pi-model").filter(
		(f) => !existsSync(resolve(MODEL_PATH, f)),
	);
	console.error(`model not fully present at: ${MODEL_PATH}`);
	if (missing.length > 0) {
		console.error("missing files:");
		for (const f of missing) console.error(`  - ${f}`);
	}
	console.error(
		"\nThe model is downloaded by the session-start worker on first agent run.\n" +
			"To populate it manually, run a session of the configured agent (Cursor/Claude Code/etc.)\n" +
			"with the PI check enabled, or invoke the model-download-worker directly:\n" +
			"  SAGE_DIR=~/.sage node packages/core/dist/model-download-worker.js\n",
	);
	process.exit(1);
}

const { DEFAULT_PI_HIGH_RISK_THRESHOLD: DENY, DEFAULT_PI_MEDIUM_RISK_THRESHOLD: ASK } =
	await import(TYPES);

function bucket(risk) {
	if (risk >= DENY) return "deny";
	if (risk >= ASK) return "ask";
	return "miss";
}

function pct(n, d) {
	return d === 0 ? "0%" : `${((n / d) * 100).toFixed(1)}%`;
}

function loadFixture(name) {
	return JSON.parse(readFileSync(resolve(FIXTURES, name), "utf-8"));
}

async function evaluate(provider, samples, label) {
	const counts = { deny: 0, ask: 0, miss: 0 };
	const rows = [];
	let totalMs = 0;

	for (const s of samples) {
		const t0 = performance.now();
		const r = await provider.checkContent(s.text, label);
		totalMs += performance.now() - t0;
		const risk = r?.risk ?? 0;
		const v = bucket(risk);
		counts[v]++;
		rows.push({ id: s.id, risk, verdict: v, sample: s });
	}

	return { counts, rows, totalMs, count: samples.length };
}

function printSuite(label, result, intent) {
	const { counts, count, totalMs } = result;
	const detected = counts.deny + counts.ask;
	const meanMs = (totalMs / count).toFixed(1);

	console.log(`\n── ${label} (${count} samples, intent: ${intent}) ──`);
	console.log(
		`  deny: ${counts.deny}  ask: ${counts.ask}  miss: ${counts.miss}  ` +
			`(mean ${meanMs}ms / sample)`,
	);

	if (intent === "should_detect") {
		console.log(
			`  Detection rate: ${detected}/${count} (${pct(detected, count)}) ` +
				`— deny ${pct(counts.deny, count)}, ask ${pct(counts.ask, count)}`,
		);
	} else {
		console.log(
			`  False-positive rate: ${detected}/${count} (${pct(detected, count)}) ` +
				`— deny-FP ${pct(counts.deny, count)}, ask-FP ${pct(counts.ask, count)}`,
		);
	}
}

function printMisclassified(label, rows, intent, limit = 5) {
	const wrong =
		intent === "should_detect"
			? rows.filter((r) => r.verdict === "miss")
			: rows.filter((r) => r.verdict !== "miss");

	if (wrong.length === 0) {
		console.log(`  ✓ no ${intent === "should_detect" ? "misses" : "false positives"}`);
		return;
	}

	const shown = wrong.slice(0, limit);
	console.log(
		`  ${wrong.length} ${intent === "should_detect" ? "miss(es)" : "false positive(s)"}` +
			(wrong.length > limit ? ` (showing first ${limit})` : "") +
			":",
	);
	for (const r of shown) {
		const tag = r.sample.technique ?? r.sample.category ?? r.sample.origin ?? "—";
		const preview = (r.sample.text ?? "").slice(0, 80).replace(/\s+/g, " ");
		console.log(
			`    [${r.verdict.padEnd(4)} ${r.risk.toFixed(3)}] id=${r.id} ${tag}: ${preview}…`,
		);
	}
}

function printBreakdown(label, rows, key) {
	const groups = {};
	for (const r of rows) {
		const k = r.sample[key] ?? "—";
		if (!groups[k]) groups[k] = { deny: 0, ask: 0, miss: 0, count: 0 };
		groups[k][r.verdict]++;
		groups[k].count++;
	}
	const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
	console.log(`  By ${key}:`);
	for (const [k, c] of sorted) {
		const det = c.deny + c.ask;
		console.log(
			`    ${k.padEnd(28)} ${det}/${c.count} (${pct(det, c.count)})  ` +
				`[deny ${c.deny}, ask ${c.ask}, miss ${c.miss}]`,
		);
	}
}

async function main() {
	console.log("Loading model:", MODEL_PATH);
	const { BundledPiProvider } = await import(PI_CHECK);

	// Use a real console logger so model-load failures surface here. Without
	// this the provider falls back to nullLogger and silently returns null on
	// every call, which makes a broken setup look like a 0% detection model.
	const consoleLogger = {
		debug: (msg, data) => console.log("[debug]", msg, data ?? ""),
		info: (msg, data) => console.log("[info]", msg, data ?? ""),
		warn: (msg, data) => console.warn("[warn]", msg, data ?? ""),
		error: (msg, data) => console.error("[error]", msg, data ?? ""),
	};

	const provider = new BundledPiProvider({ modelPath: MODEL_PATH, logger: consoleLogger });

	const warmStart = performance.now();
	const warmResult = await provider.checkContent("warmup probe", "warmup");
	console.log(`Cold start + warmup: ${(performance.now() - warmStart).toFixed(0)}ms`);

	if (warmResult === null) {
		console.error(
			"\nWarmup returned null — model failed to load. See [warn]/[error] log lines above.\n" +
				"Common causes:\n" +
				"  - model runtime not resolvable from the model dir (pi-deps-installer)\n" +
				"  - model files missing under " +
				MODEL_PATH +
				"\n  - tokenizer load error\n",
		);
		process.exit(1);
	}

	const benign = loadFixture("pi-benign-50.json");
	const injection = loadFixture("pi-injection-50.json");
	const ioc = loadFixture("pi-ioc-snippets.json");

	const benignResult = await evaluate(provider, benign.samples, "benign");
	const injectionResult = await evaluate(provider, injection.samples, "injection");
	const iocResult = await evaluate(provider, ioc.samples, "ioc");

	console.log("\n══════════════════════════════════════════════════════════");
	console.log(`  PI Accuracy Eval — thresholds: deny ≥ ${DENY}, ask ≥ ${ASK}`);
	console.log("══════════════════════════════════════════════════════════");

	printSuite("Benign", benignResult, "should_not_detect");
	printBreakdown("Benign", benignResult.rows, "category");
	printMisclassified("Benign", benignResult.rows, "should_not_detect");

	printSuite("Injection (synthetic)", injectionResult, "should_detect");
	printBreakdown("Injection", injectionResult.rows, "technique");
	printMisclassified("Injection", injectionResult.rows, "should_detect");

	printSuite("IOC snippets (real-world, sanitized)", iocResult, "should_detect");
	printBreakdown("IOC", iocResult.rows, "origin");
	printMisclassified("IOC", iocResult.rows, "should_detect");

	console.log("\nDone.\n");
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
