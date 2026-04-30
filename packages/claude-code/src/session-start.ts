#!/usr/bin/env node
/**
 * Sage SessionStart hook entry point.
 * Scans installed Claude Code plugins for threats at session startup.
 * Always exits 0 — outputs status JSON with systemMessage.
 */

import { readFileSync } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
	atomicWriteJson,
	type Branding,
	discoverPlugins,
	formatMigrationNotice,
	initSessionStatus,
	type Logger,
	loadConfig,
	needsMarketplaceMigration,
	pruneSessionStatusFiles,
	resolveBranding,
	runPluginScan,
} from "@gendigital/sage-core";
import pino from "pino";
import { pruneStaleSessionFiles } from "./approval-tracker.js";
import { STATUSLINE_MARKER } from "./constants.js";

const logger: Logger = pino({ level: "warn" }, pino.destination(2));

function getPluginRoot(): string {
	// When bundled by esbuild into CJS, __dirname points to packages/claude-code/dist/
	// Plugin root is three levels up.
	return resolve(__dirname, "..", "..", "..");
}

function getPluginManifest(pluginRoot: string): { name: string | null; version: string } {
	try {
		const manifest = readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf-8");
		const parsed = JSON.parse(manifest) as Record<string, unknown>;
		return {
			name: (parsed.name as string) ?? null,
			version: (parsed.version as string) ?? "0.0.0",
		};
	} catch {
		return { name: null, version: "0.0.0" };
	}
}

function getSessionId(): string {
	try {
		const input = readFileSync(0, "utf-8");
		const parsed = JSON.parse(input) as Record<string, unknown>;
		return (parsed.session_id as string) ?? "unknown";
	} catch {
		return "unknown";
	}
}

async function readSettingsJson(path: string): Promise<Record<string, unknown> | null> {
	let raw: string;
	try {
		raw = await readFile(path, "utf8");
	} catch {
		return {}; // Missing file — safe to create
	}
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// File exists but is corrupt
	}
	return null; // Corrupt or non-object — do not overwrite
}

// Common interpreters; matched against the token's basename so absolute paths
// like /usr/bin/env or /bin/bash are recognized too.
const INTERPRETERS = /^(bash|sh|zsh|dash|fish|env|node|deno|python\d?|perl|ruby)$/;
const SCRIPT_READ_LIMIT = 64 * 1024;

/**
 * Check if a statusline command points to a script that already references
 * sage-statusline.cjs internally (e.g. a wrapper shell script).
 *
 * Only the script path itself is read — the first non-flag, non-interpreter
 * token. Trailing arguments are ignored to avoid false positives from
 * unrelated files passed as arguments.
 */
async function scriptReferencesMarker(command: string, home: string): Promise<boolean> {
	// Handles: ~/script.sh, bash ~/script.sh, "~/script.sh" --flag, etc.
	const tokens = command.match(/(?:"([^"]+)"|'([^']+)'|(\S+))/g) ?? [];
	const scriptToken = tokens
		.map((raw) => raw.replace(/^["']|["']$/g, ""))
		.find((t) => !t.startsWith("-") && !INTERPRETERS.test(basename(t)));
	if (!scriptToken) return false;
	const resolved = scriptToken.replace(/^~/, home);
	try {
		const info = await stat(resolved);
		if (!info.isFile()) return false;
		const handle = await open(resolved, "r");
		try {
			const len = Math.min(info.size, SCRIPT_READ_LIMIT);
			const buf = Buffer.alloc(len);
			await handle.read(buf, 0, len, 0);
			return buf.toString("utf8").includes(STATUSLINE_MARKER);
		} finally {
			await handle.close();
		}
	} catch {
		return false;
	}
}

/**
 * Auto-configure Claude Code status line to display Sage session status.
 * - No existing statusLine → install Sage's
 * - Already Sage's → update path if changed
 * - Another statusLine that integrates Sage → leave it alone
 * - Another statusLine without Sage → return a hint message for the user
 */
async function configureStatusLine(pluginRoot: string, branding: Branding): Promise<string | null> {
	const home = process.env.HOME ?? "";
	if (!home) return null;

	const settingsPath = join(home, ".claude", "settings.json");
	const settings = await readSettingsJson(settingsPath);
	if (settings === null) {
		return `${branding.name}: ${settingsPath} appears corrupt — skipping status line auto-configuration.`;
	}
	const statuslineCjs = join(pluginRoot, "packages", "claude-code", "dist", "sage-statusline.cjs");
	const command = `node "${statuslineCjs}"`;

	const existing = settings.statusLine as Record<string, unknown> | undefined;
	const existingCommand =
		existing && typeof existing.command === "string" ? existing.command : null;

	if (existingCommand?.includes(STATUSLINE_MARKER)) {
		// Already Sage's — update path if changed
		if (existingCommand !== command) {
			settings.statusLine = { type: "command", command };
			await atomicWriteJson(settingsPath, settings);
		}
		return null;
	}

	if (existingCommand) {
		// Check if the command points to a wrapper script that already integrates Sage
		if (await scriptReferencesMarker(existingCommand, home)) {
			return null;
		}
		// User has a different status line — don't overwrite, suggest integration
		return `${branding.name} status line: You already have a custom status line. To add ${branding.name} status, include \`node "${statuslineCjs}"\` in your script or pipe its output alongside yours.`;
	}

	// No status line configured — install Sage's
	settings.statusLine = { type: "command", command };
	await atomicWriteJson(settingsPath, settings);
	return null;
}

async function main(): Promise<void> {
	const sessionId = getSessionId();
	const config = await loadConfig(undefined, logger);
	const branding = resolveBranding(config.brand_key, logger);

	// Prune stale files
	await pruneStaleSessionFiles(logger);
	pruneSessionStatusFiles().catch(() => {});

	const pluginRoot = getPluginRoot();
	const threatsDir = join(pluginRoot, "threats");
	const allowlistsDir = join(pluginRoot, "allowlists");
	const manifest = getPluginManifest(pluginRoot);

	// Discover plugins and filter out self
	let plugins = await discoverPlugins(undefined, logger);
	if (manifest.name) {
		const prefix = `${manifest.name}@`;
		plugins = plugins.filter((p) => !p.key.startsWith(prefix));
	}

	const statusMsg = await runPluginScan(
		logger,
		"session",
		plugins,
		threatsDir,
		allowlistsDir,
		manifest.version,
		"claude-code",
		branding,
		resolve(__dirname, "model-download-worker.cjs"),
	);

	// Initialize status file before registering the status line so the
	// statusline script always finds the file on its first poll.
	try {
		await initSessionStatus(sessionId);
	} catch {
		// Best effort
	}

	// Auto-configure status line (after status file exists)
	let statusLineHint: string | null = null;
	try {
		statusLineHint = await configureStatusLine(pluginRoot, branding);
	} catch {
		// Best-effort — don't block session start
	}

	// TODO: Remove marketplace migration check after v0.7.x // gitleaks:allow
	const migrationNeeded = await needsMarketplaceMigration();
	let finalMsg = migrationNeeded ? `${statusMsg}\n${formatMigrationNotice(branding)}` : statusMsg;
	if (statusLineHint) {
		finalMsg = `${finalMsg}\n${statusLineHint}`;
	}
	process.stdout.write(`${JSON.stringify({ systemMessage: finalMsg })}\n`);
}

main().catch(() => {
	process.stdout.write("{}\n");
});
