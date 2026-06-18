import { join } from "node:path";
import { defaultBranding } from "./brands.js";
import { resolvePath } from "./config.js";
import { getFileContent } from "./file-utils.js";
import type { Branding } from "./types.js";

function defaultAllowlistPath(): string {
	return join(resolvePath("~/.sage"), "allowlist.json");
}

type EntryType = "urls" | "commands" | "file_paths";

export async function checkAllowlistMigration(): Promise<{
	needed: boolean;
	entryTypes: EntryType[];
}> {
	try {
		const raw = await getFileContent(defaultAllowlistPath());
		const data = JSON.parse(raw) as unknown;
		if (typeof data !== "object" || data === null || Array.isArray(data)) {
			return { needed: false, entryTypes: [] };
		}
		const record = data as Record<string, unknown>;
		const found: EntryType[] = (["urls", "commands", "file_paths"] as const).filter(
			(key) =>
				typeof record[key] === "object" &&
				record[key] !== null &&
				Object.keys(record[key] as object).length > 0,
		);
		return { needed: found.length > 0, entryTypes: found };
	} catch {
		return { needed: false, entryTypes: [] };
	}
}

export function formatAllowlistMigrationWarning(
	entryTypes: EntryType[],
	branding: Branding = defaultBranding,
): string {
	const typeList = entryTypes.join(", ");
	const lines = [
		`${branding.name}: legacy allowlist.json detected with ${typeList} entries.`,
		"  - URL and file_path entries can be migrated manually to ~/.sage/exceptions.json",
		"  - Command entries are stored as SHA-256 hashes and cannot be recovered",
		"  - See https://github.com/gendigitalinc/sage for migration instructions",
	];
	return lines.join("\n");
}
