// TODO: Remove marketplace migration check after v0.7.x // gitleaks:allow
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolvePath } from "./config.js";

/**
 * Checks whether the Claude Code marketplace config still references the old
 * avast/sage repo URL. Returns true if migration notice should be shown.
 * Fail-open: returns false on any error.
 */
export async function needsMarketplaceMigration(marketplacesPath?: string): Promise<boolean> {
	try {
		const filePath =
			marketplacesPath ?? join(resolvePath("~/.claude"), "plugins", "known_marketplaces.json");
		const raw = await readFile(filePath, "utf-8");
		const data = JSON.parse(raw) as unknown;
		if (typeof data !== "object" || data === null || Array.isArray(data)) return false;

		return Object.values(data).some((entry) => {
			if (typeof entry !== "object" || entry === null) return false;
			const rec = entry as Record<string, unknown>;
			const source = rec.source as Record<string, unknown> | undefined;
			if (typeof source !== "object" || source === null) return false;
			const url = source.url;
			return typeof url === "string" && url.includes("avast/sage");
		});
	} catch {
		return false;
	}
}
