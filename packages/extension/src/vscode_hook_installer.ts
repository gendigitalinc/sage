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
	isShimCurrent,
	quote,
	resolveNodeRuntimePath,
	resolveRunnerPath,
	safeArray,
	writeHooksFile,
} from "./hook_installer_shared.js";
import type { ManagedHookHealth, ManagedHookInstallOptions } from "./managedHooks.js";

const MANAGED_MARKER = "--managed-by sage-vscode";

interface CopilotHooksFile {
	hooks: HookMap;
	[key: string]: unknown;
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
		shimCurrent: true, // freshly written by buildHookCommand above
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

	const shimFile = process.platform === "win32" ? "sage-hook.cmd" : "sage-hook";
	const shimPath = path.join(path.dirname(configPath), shimFile);
	const shimCurrent = await isShimCurrent(shimPath, runnerPath);

	return {
		configPath,
		runnerPath,
		installedEvents,
		managedCommands: collectManagedCommands(hooksFile.hooks, MANAGED_MARKER),
		shimCurrent,
	};
}

function resolveHooksPath(): string {
	return path.join(os.homedir(), ".copilot", "hooks", "hooks.json");
}

async function buildHookCommand(
	configPath: string,
	nodePath: string,
	runnerPath: string,
	appRoot: string,
): Promise<string> {
	const configDir = path.dirname(configPath);
	const shimPath = await createHookShim(configDir, nodePath, runnerPath, appRoot);
	if (process.platform === "win32") {
		return `& ${quote(shimPath)} vscode ${MANAGED_MARKER}`;
	}
	return `${quote(shimPath)} vscode ${MANAGED_MARKER}`;
}

function upsertManagedHooks(existing: CopilotHooksFile, command: string): CopilotHooksFile {
	const hooks = { ...existing.hooks };

	hooks.PreToolUse = appendManaged(
		hooks.PreToolUse,
		{ type: "command", command, timeout: HOOK_TIMEOUT_SECONDS },
		MANAGED_MARKER,
	);

	return { ...existing, hooks };
}

function removeManagedEntries(existing: CopilotHooksFile): CopilotHooksFile {
	const hooks: HookMap = {};
	for (const [eventName, entries] of Object.entries(existing.hooks)) {
		const filtered = safeArray(entries).filter((entry) => !isManagedEntry(entry, MANAGED_MARKER));
		if (filtered.length > 0) {
			hooks[eventName] = filtered;
		}
	}
	return { ...existing, hooks };
}

async function readHooksFile(filePath: string): Promise<CopilotHooksFile> {
	try {
		const parsed = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
		const { hooks, ...rest } = parsed;
		return {
			...rest,
			hooks: (hooks && typeof hooks === "object" ? hooks : {}) as HookMap,
		};
	} catch {
		return { hooks: {} };
	}
}
