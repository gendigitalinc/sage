#!/usr/bin/env node
/**
 * Sage status line script for Claude Code.
 * Reads session context JSON from stdin, outputs status string to stdout.
 * Designed to be referenced in ~/.claude/settings.json statusLine config.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	formatStatusLine,
	loadBrandingSync,
	resolvePath,
	sanitizeSessionId,
} from "@gendigital/sage-core";

function main(): void {
	const branding = loadBrandingSync();

	let sessionId = "";
	try {
		const input = JSON.parse(readFileSync(0, "utf-8"));
		sessionId = (input.session_id ?? "") as string;
	} catch {
		// No stdin or invalid JSON — show clean status
	}

	if (!sessionId) {
		process.stdout.write(`🛡️ ${branding.product_name}: ✅\n`);
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
		process.stdout.write(`${formatStatusLine(0, 0, undefined, undefined, branding)}\n`);
	}
}

main();
