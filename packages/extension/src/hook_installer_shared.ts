import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

export type HookEntry = Record<string, unknown> & { command?: string };
export type HookMap = Record<string, HookEntry[]>;

const UNSAFE_SHIM_PATH_PATTERN = /["`$;&|<>\r\n\0%!]/;

export function safeArray(entries: unknown): HookEntry[] {
	return Array.isArray(entries) ? entries : [];
}

export async function resolveRunnerPath(context: vscode.ExtensionContext): Promise<string> {
	const configured =
		vscode.workspace.getConfiguration().get<string>("sage.hookRunnerPath")?.trim() ?? "";
	if (configured) {
		await access(configured);
		return configured;
	}

	const candidates = [
		context.asAbsolutePath(path.join("dist", "sage-hook.cjs")),
		context.asAbsolutePath(path.join("resources", "sage-hook.cjs")),
	];

	for (const candidate of candidates) {
		try {
			await access(candidate);
			return candidate;
		} catch {
			// Try next candidate.
		}
	}

	throw new Error(
		"Unable to locate sage-hook runner. Build packages/extension or set sage.hookRunnerPath.",
	);
}

export function resolveNodeRuntimePath(): string {
	return process.env.VSCODE_NODE_EXEC_PATH?.trim() || process.execPath;
}

export function assertSafePathForShim(pathValue: string, label: string): void {
	if (!pathValue) {
		throw new Error(`${label} path is empty.`);
	}
	if (UNSAFE_SHIM_PATH_PATTERN.test(pathValue)) {
		throw new Error(`${label} path contains unsupported characters for generated hook shims.`);
	}
}

/**
 * Generate the per-host hook-runner shim scripts.
 *
 * `appRoot` is the host application root (typically `vscode.env.appRoot` —
 * Cursor or VS Code). It is exported into the shim environment as
 * `SAGE_APP_ROOT` so the hook runner child process can resolve the agent
 * runtime version at startup via `readProductJsonVersion(SAGE_APP_ROOT)`,
 * instead of baking a value at install time that would go stale on host
 * auto-update. The same shell-injection guard (`assertSafePathForShim`) that
 * protects `nodePath` and `runnerPath` is applied to `appRoot`.
 */
export async function createHookShim(
	hooksDir: string,
	nodePath: string,
	runnerPath: string,
	appRoot: string,
): Promise<string> {
	assertSafePathForShim(nodePath, "Node runtime");
	assertSafePathForShim(runnerPath, "Hook runner");
	assertSafePathForShim(appRoot, "App root");

	const posixShim = path.join(hooksDir, "sage-hook");
	const windowsShim = path.join(hooksDir, "sage-hook.cmd");

	await mkdir(hooksDir, { recursive: true });
	await writeFile(
		posixShim,
		`#!/usr/bin/env sh\nexport ELECTRON_RUN_AS_NODE=1\nexport SAGE_APP_ROOT="${appRoot}"\n"${nodePath}" "${runnerPath}" "$@"\n`,
		"utf8",
	);
	await chmod(posixShim, 0o755);

	await writeFile(
		windowsShim,
		`@echo off\r\nsetlocal\r\nset ELECTRON_RUN_AS_NODE=1\r\nset SAGE_APP_ROOT=${appRoot}\r\n"${nodePath}" "${runnerPath}" %*\r\n`,
		"utf8",
	);

	return process.platform === "win32" ? windowsShim : posixShim;
}

export function isManagedEntry(entry: HookEntry, marker: string): boolean {
	return typeof entry.command === "string" && entry.command.includes(marker);
}

export function appendManaged(
	entries: HookEntry[] | undefined,
	managedEntry: HookEntry,
	marker: string,
): HookEntry[] {
	const retained = safeArray(entries).filter((entry) => !isManagedEntry(entry, marker));
	return [...retained, managedEntry];
}

export function collectManagedCommands(hooks: HookMap, marker: string): string[] {
	const commands = new Set<string>();
	for (const entries of Object.values(hooks)) {
		for (const entry of safeArray(entries)) {
			if (!isManagedEntry(entry, marker) || typeof entry.command !== "string") {
				continue;
			}
			commands.add(entry.command);
		}
	}
	return [...commands];
}

export async function writeHooksFile(filePath: string, data: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function quote(value: string): string {
	return `"${value.replace(/"/g, '\\"')}"`;
}
