import { type FSWatcher, mkdirSync, watch } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
	type AgentRuntime,
	ConfigSchema,
	checkForUpdate,
	getInstallationId,
	getRecentEntries,
	loadConfig,
	pruneOrphanedTmpFiles,
	resolvePath,
	type SessionStatus,
} from "@gendigital/sage-core";
import * as vscode from "vscode";
import { disabledUntilKey, shouldAutoEnable } from "./auto_enable_logic.js";
import type {
	ManagedHookHealth,
	ManagedHookInstallOptions,
	ManagedHookScope,
} from "./managedHooks.js";
import {
	installCursorMcpServer,
	registerVsCodeMcpServerProvider,
	removeCursorMcpServer,
} from "./mcp_config_installer.js";

interface ManagedHookInstaller {
	installManagedHooks(options: ManagedHookInstallOptions): Promise<ManagedHookHealth>;
	removeManagedHooks(scope: ManagedHookScope): Promise<string>;
	getHookHealth(options: ManagedHookInstallOptions): Promise<ManagedHookHealth>;
}

interface ExtensionTarget {
	hostName: string;
	scopeSettingKey: string;
	installer: ManagedHookInstaller;
}

export function activateManagedHooksExtension(
	context: vscode.ExtensionContext,
	target: ExtensionTarget,
): void {
	// Best-effort cleanup of orphaned .tmp files from crashed atomic writes
	pruneOrphanedTmpFiles(resolvePath("~/.sage")).catch(() => {});

	// Watch ~/.sage/ for statusline file changes and show IDE notifications
	setupStatusFileWatcher(context);

	const version = (context.extension.packageJSON as Record<string, unknown>).version as string;
	if (version) {
		const agentRuntime: AgentRuntime = target.hostName === "Cursor" ? "cursor" : "vscode";
		const sageDirPath = resolvePath("~/.sage");
		getInstallationId(sageDirPath)
			.then((iid) => {
				if (!iid) {
					return;
				}

				checkForUpdate(version, undefined, undefined, {
					agentRuntime,
					agentRuntimeVersion: vscode.version,
					iid,
				}).then((result) => {
					if (result?.updateAvailable) {
						void vscode.window.showInformationMessage(
							`Sage: Update available v${result.currentVersion} → v${result.latestVersion} (https://github.com/gendigitalinc/sage)`,
						);
					}
				});
			})
			.catch(() => {
				// Fail-open: never block extension activation
			});
	}

	context.subscriptions.push(
		vscode.commands.registerCommand("sage.enableProtection", async () => {
			await withErrorBoundary(async () => {
				const scope = getScope(target.scopeSettingKey);
				const hookHealth = await target.installer.installManagedHooks({ context, scope });
				if (target.hostName === "Cursor") {
					await installCursorMcpServer(context);
				}
				await context.globalState.update(disabledUntilKey(target.hostName, scope), undefined);
				vscode.window.showInformationMessage(
					`Sage enabled for ${target.hostName}. Managed hooks configured at ${hookHealth.configPath}.`,
				);
			});
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("sage.disableProtection", async () => {
			await withErrorBoundary(async () => {
				const scope = getScope(target.scopeSettingKey);
				const configPath = await target.installer.removeManagedHooks(scope);
				if (target.hostName === "Cursor") {
					await removeCursorMcpServer();
				}
				await context.globalState.update(disabledUntilKey(target.hostName, scope), Date.now());
				vscode.window.showInformationMessage(
					`Sage disabled until restart. Hooks removed from ${configPath}. Protection will re-enable on next startup.`,
				);
			});
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("sage.openConfig", async () => {
			await withErrorBoundary(async () => {
				const configPath = path.join(resolvePath("~/.sage"), "config.json");
				await ensureFile(configPath, `${JSON.stringify(ConfigSchema.parse({}), null, 2)}\n`);
				const document = await vscode.workspace.openTextDocument(configPath);
				await vscode.window.showTextDocument(document);
			});
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("sage.openExceptions", async () => {
			await withErrorBoundary(async () => {
				const exceptionsPath = path.join(resolvePath("~/.sage"), "exceptions.json");
				await ensureFile(exceptionsPath, `${JSON.stringify({ rules: [] }, null, 2)}\n`);
				const document = await vscode.workspace.openTextDocument(exceptionsPath);
				await vscode.window.showTextDocument(document);
			});
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("sage.openAuditLog", async () => {
			await withErrorBoundary(async () => {
				const config = await loadConfig();
				const auditPath = resolvePath(config.logging.path);
				await ensureFile(auditPath, "");
				const document = await vscode.workspace.openTextDocument(auditPath);
				await vscode.window.showTextDocument(document);
			});
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("sage.showHookHealth", async () => {
			await withErrorBoundary(async () => {
				const scope = getScope(target.scopeSettingKey);
				const health = await target.installer.getHookHealth({ context, scope });
				const config = await loadConfig();
				const recentEntries = await getRecentEntries(config.logging, 1);
				const latest =
					recentEntries.length > 0 &&
					typeof recentEntries[0] === "object" &&
					recentEntries[0] !== null
						? (recentEntries[0] as Record<string, unknown>)
						: undefined;
				const lastVerdict =
					latest && typeof latest.verdict === "string" && typeof latest.severity === "string"
						? `${latest.verdict} (${latest.severity})`
						: "none";

				const message = [
					`target: ${target.hostName}`,
					`hooks config: ${health.configPath}`,
					`hook command: ${
						health.managedCommands.length > 0 ? health.managedCommands.join(" | ") : "none"
					}`,
					`runner bundle: ${health.runnerPath ?? "not found"}`,
					`managed events: ${
						health.installedEvents.length > 0 ? health.installedEvents.join(", ") : "none"
					}`,
					`last verdict: ${lastVerdict}`,
				].join("\n");

				void vscode.window.showInformationMessage(message, { modal: true });
			});
		}),
	);

	// Minimal-friction defaults: enable protection + MCP server on startup (opt-out settings)
	void autoEnableOnStartup(context, target);
}

async function autoEnableOnStartup(
	context: vscode.ExtensionContext,
	target: ExtensionTarget,
): Promise<void> {
	// Don't ever block activation.
	try {
		if (target.hostName !== "Cursor") {
			registerVsCodeMcpServerProvider(context);
		}

		const scope = getScope(target.scopeSettingKey);

		const key = disabledUntilKey(target.hostName, scope);
		const disabledAt = context.globalState.get<number>(key);
		if (!shouldAutoEnable(disabledAt, Date.now())) {
			return;
		}
		await context.globalState.update(key, undefined);

		const hookHealth = await target.installer.getHookHealth({ context, scope }).catch(() => null);
		const hasManagedHooks = !!hookHealth && hookHealth.installedEvents.length > 0;
		if (!hasManagedHooks) {
			await target.installer.installManagedHooks({ context, scope });
		}

		if (target.hostName === "Cursor") {
			await installCursorMcpServer(context);
		}

		const shownKey = `sage.autoEnabledShown.${target.hostName}.${scope}`;
		if (!context.globalState.get<boolean>(shownKey)) {
			await context.globalState.update(shownKey, true);
			void vscode.window.showInformationMessage(
				`Sage: Protection auto-enabled for ${target.hostName}. Disable via "Sage: Disable protection until restart".`,
			);
		}
	} catch {
		// Fail-open: never block extension activation.
	}
}

function getScope(scopeSettingKey: string): ManagedHookScope {
	const value = vscode.workspace.getConfiguration().get<string>(scopeSettingKey);
	return value === "workspace" ? "workspace" : "user";
}

async function ensureFile(filePath: string, content: string): Promise<void> {
	try {
		await access(filePath);
	} catch {
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, content, "utf8");
	}
}

async function withErrorBoundary(work: () => Promise<void>): Promise<void> {
	try {
		await work();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		void vscode.window.showErrorMessage(`Sage: ${message}`);
	}
}

function setupStatusFileWatcher(context: vscode.ExtensionContext): void {
	const sageDir = resolvePath("~/.sage");
	const knownState = new Map<string, { denied: number; flagged: number }>();
	let watcher: FSWatcher | undefined;

	try {
		mkdirSync(sageDir, { recursive: true });
		watcher = watch(sageDir, async (_eventType, filename) => {
			if (!filename || !filename.startsWith("statusline-") || !filename.endsWith(".txt")) return;

			try {
				const filePath = path.join(sageDir, filename);
				const raw = await readFile(filePath, "utf8");
				const data = JSON.parse(raw) as SessionStatus;
				const prev = knownState.get(filename) ?? { denied: 0, flagged: 0 };

				if (data.denied > prev.denied) {
					const reason = data.lastReason ?? "Threat detected";
					const category = data.lastCategory ?? "unknown";
					void vscode.window.showErrorMessage(`Sage blocked: ${reason} (${category})`);
				} else if (data.flagged > prev.flagged) {
					const reason = data.lastReason ?? "Action flagged";
					const category = data.lastCategory ?? "unknown";
					void vscode.window.showWarningMessage(`Sage flagged: ${reason} (${category})`);
				}

				knownState.set(filename, { denied: data.denied, flagged: data.flagged });
			} catch {
				// File may be mid-write or deleted — ignore
			}
		});
	} catch {
		// ~/.sage/ may not exist yet — watcher will be absent, no notifications
		return;
	}

	if (watcher) {
		context.subscriptions.push({ dispose: () => watcher.close() });
	}
}
