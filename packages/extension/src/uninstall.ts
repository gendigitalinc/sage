import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type HookEntry = Record<string, unknown> & { command?: string };
type HookMap = Record<string, HookEntry[]>;

interface HostConfig {
	hooksFile: string;
	shimDir: string;
	marker: string;
}

const HOSTS: Record<string, HostConfig> = {
	vscode: {
		hooksFile: path.join(os.homedir(), ".copilot", "hooks", "hooks.json"),
		shimDir: path.join(os.homedir(), ".copilot", "hooks"),
		marker: "--managed-by sage-vscode",
	},
	cursor: {
		hooksFile: path.join(os.homedir(), ".cursor", "hooks.json"),
		shimDir: path.join(os.homedir(), ".cursor", "hooks"),
		marker: "--managed-by sage-cursor",
	},
};

function isManagedEntry(entry: unknown, marker: string): boolean {
	if (!entry || typeof entry !== "object") return false;
	const cmd = (entry as HookEntry).command;
	return typeof cmd === "string" && cmd.includes(marker);
}

function filterHooks(hooks: HookMap, marker: string): HookMap {
	const result: HookMap = {};
	for (const [event, entries] of Object.entries(hooks)) {
		if (!Array.isArray(entries)) continue;
		const filtered = entries.filter((entry: unknown) => !isManagedEntry(entry, marker));
		if (filtered.length > 0) {
			result[event] = filtered;
		}
	}
	return result;
}

async function cleanHooksFile(config: HostConfig): Promise<void> {
	let raw: string;
	try {
		raw = await readFile(config.hooksFile, "utf8");
	} catch {
		return;
	}

	const parsed = JSON.parse(raw) as Record<string, unknown>;
	const hooks = (parsed.hooks && typeof parsed.hooks === "object" ? parsed.hooks : {}) as HookMap;
	const cleaned = filterHooks(hooks, config.marker);
	const updated = { ...parsed, hooks: cleaned };
	await writeFile(config.hooksFile, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

async function cleanShimFiles(shimDir: string): Promise<void> {
	await rm(path.join(shimDir, "sage-hook"), { force: true });
	await rm(path.join(shimDir, "sage-hook.cmd"), { force: true });
}

async function main(): Promise<void> {
	const host = process.argv[2];
	const config = host ? HOSTS[host] : undefined;
	if (!config) {
		process.exit(1);
	}

	try {
		await cleanHooksFile(config);
	} catch {
		// Best-effort
	}

	try {
		await cleanShimFiles(config.shimDir);
	} catch {
		// Best-effort
	}
}

main();
