#!/usr/bin/env node
/**
 * Sage status line script for Claude Code.
 * Reads session context JSON from stdin, outputs status string to stdout.
 * Designed to be referenced in ~/.claude/settings.json statusLine config.
 */

import {
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
	formatStatusLine,
	getClaudeConfigDir,
	isPluginInstalledSync,
	loadConfigSync,
	resolveBranding,
	resolvePath,
	sanitizeSessionId,
} from "@gendigital/sage-core";
import { STATUSLINE_MARKER } from "./constants.js";

const STATUS_PREFIX = "statusline-";
const STATUS_SUFFIX = ".txt";

function getPluginName(): string | null {
	try {
		const pluginRoot = resolve(__dirname, "..", "..", "..");
		const raw = readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf-8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		return (parsed.name as string) ?? null;
	} catch {
		return null;
	}
}

// Plugins loaded via --plugin-dir live outside ~/.claude/ and are not in the
// registry. Only check the registry for marketplace-installed plugins to avoid
// false "uninstalled" cleanup when running from a local checkout.
function isMarketplaceInstallation(): boolean {
	try {
		// realpathSync both sides so symlinks (e.g. /var → /private/var on macOS)
		// don't cause a false mismatch.
		const pluginRoot = realpathSync(resolve(__dirname, "..", "..", ".."));
		const claudeDir = realpathSync(getClaudeConfigDir());
		return pluginRoot.startsWith(claudeDir);
	} catch {
		return false;
	}
}

function isPluginRegistered(): boolean {
	const pluginName = getPluginName();
	if (!pluginName) return true;

	const result = isPluginInstalledSync(pluginName);
	return result ?? true;
}

function isPluginEnabled(): boolean {
	const pluginName = getPluginName();
	if (!pluginName) return true;

	try {
		const settingsPath = join(getClaudeConfigDir(), "settings.json");
		const raw = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(raw) as Record<string, unknown>;
		const enabled = settings.enabledPlugins as Record<string, unknown> | undefined;
		if (!enabled) return true;
		for (const key of Object.keys(enabled)) {
			const lastAt = key.lastIndexOf("@");
			const name = lastAt > 0 ? key.substring(0, lastAt) : key;
			if (name === pluginName) return enabled[key] !== false;
		}
	} catch {
		// Best effort — assume enabled
	}
	return true;
}

function removeOwnStatusLine(): boolean {
	const settingsPath = join(getClaudeConfigDir(), "settings.json");
	try {
		const raw = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(raw) as Record<string, unknown>;
		const sl = settings.statusLine as Record<string, unknown> | undefined;
		if (sl && typeof sl.command === "string" && sl.command.includes(STATUSLINE_MARKER)) {
			delete settings.statusLine;
			const tmp = `${settingsPath}.${process.pid}.tmp`;
			writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
			renameSync(tmp, settingsPath);
		}
		return true;
	} catch {
		return false;
	}
}

function pruneStatusFiles(): void {
	try {
		const dir = resolvePath("~/.sage");
		const entries = readdirSync(dir);
		for (const entry of entries) {
			if (!entry.startsWith(STATUS_PREFIX) || !entry.endsWith(STATUS_SUFFIX)) continue;
			try {
				unlinkSync(join(dir, entry));
			} catch {
				// Best effort
			}
		}
	} catch {
		// Dir doesn't exist or unreadable
	}
}

function shouldCleanup(): boolean {
	// --plugin-dir installs live outside ~/.claude/ and won't appear in the
	// marketplace registry or enabledPlugins — skip cleanup entirely so we
	// don't falsely tear down a working local-checkout installation.
	if (!isMarketplaceInstallation()) return false;
	return !isPluginRegistered() || !isPluginEnabled();
}

function main(): void {
	const config = loadConfigSync();
	const branding = resolveBranding(config.brand_key);

	let sessionId = "";
	try {
		const input = JSON.parse(readFileSync(0, "utf-8"));
		sessionId = (input.session_id ?? "") as string;
	} catch {
		// No stdin or invalid JSON
	}

	if (shouldCleanup()) {
		if (removeOwnStatusLine()) {
			pruneStatusFiles();
		}
		return;
	}

	if (!sessionId) {
		process.stdout.write(`🛡️ ${branding.name}: ✅\n`);
		return;
	}

	const statusFile = join(resolvePath("~/.sage"), `statusline-${sanitizeSessionId(sessionId)}.txt`);
	try {
		const raw = readFileSync(statusFile, "utf-8");
		const data = JSON.parse(raw) as {
			denied?: number;
			flagged?: number;
			lastReason?: string | null;
			lastCategory?: string | null;
		};
		process.stdout.write(
			`${formatStatusLine(data.denied ?? 0, data.flagged ?? 0, data.lastReason, data.lastCategory, branding)}\n`,
		);
	} catch {
		// Status file missing — either session-start hasn't created it yet
		// (startup race) or the plugin was loaded via --plugin-dir in a
		// previous session but isn't active now. We can't modify settings.json
		// here because Claude Code caches the statusLine config and won't
		// pick up a re-registration by session-start within the same session.
		// A stale ✅ from a stopped --plugin-dir is a minor cosmetic tradeoff.
		process.stdout.write(`🛡️ ${branding.name}: ✅\n`);
	}
}

main();
