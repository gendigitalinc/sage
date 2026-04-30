import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type Branding, defaultBranding, HOOK_TIMEOUT_SECONDS } from "@gendigital/sage-core";
import * as vscode from "vscode";
import {
	appendManaged,
	collectManagedCommands,
	createHookShim,
	type HookMap,
	isManagedEntry,
	quote,
	resolveNodeRuntimePath,
	resolveRunnerPath,
	safeArray,
	writeHooksFile,
} from "./hook_installer_shared.js";
import type { ManagedHookHealth, ManagedHookInstallOptions } from "./managedHooks.js";

const MANAGED_MARKER = "--managed-by sage-cursor";

interface CursorHooksFile {
	version: number;
	hooks: HookMap;
}

export async function installManagedHooks(
	options: ManagedHookInstallOptions,
	_branding: Branding = defaultBranding,
): Promise<ManagedHookHealth> {
	const configPath = resolveHooksPath();
	await mkdir(path.dirname(configPath), { recursive: true });

	const runnerPath = await resolveRunnerPath(options.context);
	const nodePath = resolveNodeRuntimePath();
	const command = await buildHookCommand(configPath, nodePath, runnerPath, vscode.env.appRoot);

	const hooksFile = await readHooksFile(configPath);
	const updated = upsertManagedHooks(hooksFile, command);
	await writeHooksFile(configPath, updated);

	const installedEvents = Object.keys(updated.hooks).filter((name) =>
		safeArray(updated.hooks[name]).some((entry) => isManagedEntry(entry, MANAGED_MARKER)),
	);

	return {
		configPath,
		runnerPath,
		installedEvents,
		managedCommands: collectManagedCommands(updated.hooks, MANAGED_MARKER),
	};
}

export async function removeManagedHooks(): Promise<string> {
	const configPath = resolveHooksPath();
	const hooksFile = await readHooksFile(configPath);
	const updated = removeManagedEntries(hooksFile);
	await writeHooksFile(configPath, updated);
	return configPath;
}

export async function getHookHealth(
	options: ManagedHookInstallOptions,
): Promise<ManagedHookHealth> {
	const configPath = resolveHooksPath();
	const hooksFile = await readHooksFile(configPath);
	const runnerPath = await resolveRunnerPath(options.context).catch(() => undefined);

	const installedEvents = Object.keys(hooksFile.hooks).filter((eventName) =>
		safeArray(hooksFile.hooks[eventName]).some((entry) => isManagedEntry(entry, MANAGED_MARKER)),
	);

	return {
		configPath,
		runnerPath,
		installedEvents,
		managedCommands: collectManagedCommands(hooksFile.hooks, MANAGED_MARKER),
	};
}

function resolveHooksPath(): string {
	return path.join(os.homedir(), ".cursor", "hooks.json");
}

async function buildHookCommand(
	configPath: string,
	nodePath: string,
	runnerPath: string,
	appRoot: string,
): Promise<string> {
	const cursorConfigDir = path.dirname(configPath);
	const shimPath = await createHookShim(
		path.join(cursorConfigDir, "hooks"),
		nodePath,
		runnerPath,
		appRoot,
	);
	if (process.platform === "win32") {
		return `& ${quote(shimPath)} cursor ${MANAGED_MARKER}`;
	}
	return `${quote(shimPath)} cursor ${MANAGED_MARKER}`;
}

function upsertManagedHooks(existing: CursorHooksFile, command: string): CursorHooksFile {
	const hooks = { ...existing.hooks };

	hooks.beforeShellExecution = appendManaged(
		hooks.beforeShellExecution,
		{ command, timeout: HOOK_TIMEOUT_SECONDS },
		MANAGED_MARKER,
	);
	hooks.preToolUse = appendManaged(
		hooks.preToolUse,
		{ matcher: "Write|Delete|Edit|WebFetch", command, timeout: HOOK_TIMEOUT_SECONDS },
		MANAGED_MARKER,
	);
	hooks.beforeMCPExecution = appendManaged(
		hooks.beforeMCPExecution,
		{ command, timeout: HOOK_TIMEOUT_SECONDS },
		MANAGED_MARKER,
	);
	hooks.beforeReadFile = appendManaged(
		hooks.beforeReadFile,
		{ command, timeout: HOOK_TIMEOUT_SECONDS },
		MANAGED_MARKER,
	);
	hooks.postToolUse = appendManaged(
		hooks.postToolUse,
		{ command, timeout: HOOK_TIMEOUT_SECONDS },
		MANAGED_MARKER,
	);

	return { version: 1, hooks };
}

function removeManagedEntries(existing: CursorHooksFile): CursorHooksFile {
	const hooks: HookMap = {};
	for (const [eventName, entries] of Object.entries(existing.hooks)) {
		const filtered = safeArray(entries).filter((entry) => !isManagedEntry(entry, MANAGED_MARKER));
		if (filtered.length > 0) {
			hooks[eventName] = filtered;
		}
	}
	return { version: existing.version || 1, hooks };
}

async function readHooksFile(filePath: string): Promise<CursorHooksFile> {
	try {
		const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<CursorHooksFile>;
		return {
			version: parsed.version ?? 1,
			hooks: parsed.hooks ?? {},
		};
	} catch {
		return { version: 1, hooks: {} };
	}
}
