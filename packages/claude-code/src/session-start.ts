#!/usr/bin/env node
/**
 * Sage SessionStart hook entry point.
 * Scans installed Claude Code plugins for threats at session startup.
 * Always exits 0 — outputs status JSON with systemMessage.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
	atomicWriteJson,
	discoverPlugins,
	formatMigrationNotice,
	initSessionStatus,
	type Logger,
	needsMarketplaceMigration,
	pruneSessionStatusFiles,
	runPluginScan,
} from "@gendigital/sage-core";
import pino from "pino";
import { pruneStaleSessionFiles } from "./approval-tracker.js";

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

const STATUSLINE_MARKER = "sage-statusline.cjs";

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

/**
 * Auto-configure Claude Code status line to display Sage session status.
 * - No existing statusLine → install Sage's
 * - Already Sage's → update path if needed
 * - Another statusLine → return a hint message for the user
 */
async function configureStatusLine(pluginRoot: string): Promise<string | null> {
	const home = process.env.HOME ?? "";
	if (!home) return null;

	const settingsPath = join(home, ".claude", "settings.json");
	const settings = await readSettingsJson(settingsPath);
	if (settings === null) {
		return `Sage: ${settingsPath} appears corrupt — skipping status line auto-configuration.`;
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
		// User has a different status line — don't overwrite, suggest integration
		return `Sage status line: You already have a custom status line. To add Sage status, include \`node "${statuslineCjs}"\` in your script or pipe its output alongside yours.`;
	}

	// No status line configured — install Sage's
	settings.statusLine = { type: "command", command };
	await atomicWriteJson(settingsPath, settings);
	return null;
}

async function main(): Promise<void> {
	const sessionId = getSessionId();

	// Prune stale files
	await pruneStaleSessionFiles(logger);
	pruneSessionStatusFiles().catch(() => {});

	// Initialize session status file
	initSessionStatus(sessionId).catch(() => {});

	const pluginRoot = getPluginRoot();
	const threatsDir = join(pluginRoot, "threats");
	const allowlistsDir = join(pluginRoot, "allowlists");
	const manifest = getPluginManifest(pluginRoot);

	// Auto-configure status line
	let statusLineHint: string | null = null;
	try {
		statusLineHint = await configureStatusLine(pluginRoot);
	} catch {
		// Best-effort — don't block session start
	}

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
	);

	// TODO: Remove marketplace migration check after v0.7.x // gitleaks:allow
	const migrationNeeded = await needsMarketplaceMigration();
	let finalMsg = migrationNeeded ? `${statusMsg}\n${formatMigrationNotice()}` : statusMsg;
	if (statusLineHint) {
		finalMsg = `${finalMsg}\n${statusLineHint}`;
	}
	process.stdout.write(`${JSON.stringify({ systemMessage: finalMsg })}\n`);
}

main().catch(() => {
	process.stdout.write("{}\n");
});
