import { type FSWatcher, mkdirSync, watch } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
	type Branding,
	ConfigSchema,
	getRecentEntries,
	loadConfig,
	loadConfigSync,
	resolveBranding,
	resolvePath,
	type SessionStatus,
} from "@gendigital/sage-core";
import * as vscode from "vscode";
import { disabledUntilKey, shouldAutoEnable } from "./auto_enable_logic.js";
import { createExtensionLogger } from "./extension-logger.js";
import type { ManagedHookHealth, ManagedHookInstallOptions } from "./managedHooks.js";
import {
	installCursorMcpServer,
	registerVsCodeMcpServerProvider,
	removeCursorMcpServer,
} from "./mcp_config_installer.js";
import { createExtensionScanHandler } from "./startup-scan.js";

interface ManagedHookInstaller {
	installManagedHooks(
		options: ManagedHookInstallOptions,
		branding?: Branding,
	): Promise<ManagedHookHealth>;
	removeManagedHooks(): Promise<string>;
	getHookHealth(options: ManagedHookInstallOptions): Promise<ManagedHookHealth>;
}

interface ExtensionTarget {
	hostName: string;
	installer: ManagedHookInstaller;
}

export function activateManagedHooksExtension(
	context: vscode.ExtensionContext,
	target: ExtensionTarget,
): void {
	const config = loadConfigSync();
	const branding = resolveBranding(config.brand_key);

	// Watch ~/.sage/ for statusline file changes and show IDE notifications
	setupStatusFileWatcher(context, branding);

	// Session-start plugin scan (fire-and-forget, fail-open).
	// runSessionStart (called internally) handles update check, model download,
	// and temp-file cleanup — no need to duplicate those here.
	const logger = createExtensionLogger(branding);
	const scanHandler = createExtensionScanHandler(
		context,
		target.hostName,
		logger,
		branding,
		(msg) => {
			if (msg.includes("Threat Detected")) {
				void vscode.window.showErrorMessage(msg);
			} else if (msg.includes("Update available")) {
				void vscode.window.showInformationMessage(msg);
			} else {
				logger.info(msg);
			}
		},
	);
	scanHandler().catch(() => {});

	// Set brand context variable for command palette filtering
	if (branding.brand_key) {
		const knownBrands = extractKnownBrandsFromManifest(context);
		if (knownBrands.has(branding.brand_key)) {
			vscode.commands.executeCommand("setContext", "sage.brandKey", branding.brand_key);
		}
	}

	const errorBoundary = withErrorBoundary(branding);

	// Discover all command variants from own manifest for dynamic registration
	const pkg = context.extension.packageJSON as Record<string, unknown>;
	const contributes = pkg.contributes as Record<string, unknown> | undefined;
	const allCommands = ((contributes?.commands ?? []) as Array<{ command: string }>).map(
		(c) => c.command,
	);

	function registerForAllVariants(baseId: string, handler: () => Promise<void>): void {
		const variants = allCommands.filter((c) => c === baseId || c.startsWith(`${baseId}.`));
		for (const cmdId of variants) {
			context.subscriptions.push(vscode.commands.registerCommand(cmdId, handler));
		}
	}

	registerForAllVariants("sage.enableProtection", async () => {
		await errorBoundary(async () => {
			const hookHealth = await target.installer.installManagedHooks({ context }, branding);
			if (target.hostName === "Cursor") {
				await installCursorMcpServer(context);
			}
			await context.globalState.update(disabledUntilKey(target.hostName), undefined);
			vscode.window.showInformationMessage(
				`${branding.short_name} enabled for ${target.hostName}. Managed hooks configured at ${hookHealth.configPath}.`,
			);
		});
	});

	registerForAllVariants("sage.disableProtection", async () => {
		await errorBoundary(async () => {
			const configPath = await target.installer.removeManagedHooks();
			if (target.hostName === "Cursor") {
				await removeCursorMcpServer();
			}
			await context.globalState.update(disabledUntilKey(target.hostName), Date.now());
			vscode.window.showInformationMessage(
				`${branding.short_name} disabled until restart. Hooks removed from ${configPath}. Protection will re-enable on next startup.`,
			);
		});
	});

	registerForAllVariants("sage.openConfig", async () => {
		await errorBoundary(async () => {
			const configPath = path.join(resolvePath("~/.sage"), "config.json");
			await ensureFile(configPath, `${JSON.stringify(ConfigSchema.parse({}), null, 2)}\n`);
			const document = await vscode.workspace.openTextDocument(configPath);
			await vscode.window.showTextDocument(document);
		});
	});

	registerForAllVariants("sage.openExceptions", async () => {
		await errorBoundary(async () => {
			const exceptionsPath = path.join(resolvePath("~/.sage"), "exceptions.json");
			await ensureFile(exceptionsPath, `${JSON.stringify({ rules: [] }, null, 2)}\n`);
			const document = await vscode.workspace.openTextDocument(exceptionsPath);
			await vscode.window.showTextDocument(document);
		});
	});

	registerForAllVariants("sage.openAuditLog", async () => {
		await errorBoundary(async () => {
			const config = await loadConfig();
			const auditPath = resolvePath(config.logging.path);
			await ensureFile(auditPath, "");
			const document = await vscode.workspace.openTextDocument(auditPath);
			await vscode.window.showTextDocument(document);
		});
	});

	registerForAllVariants("sage.showHookHealth", async () => {
		await errorBoundary(async () => {
			const health = await target.installer.getHookHealth({ context });
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
	});

	// Minimal-friction defaults: enable protection + MCP server on startup (opt-out settings)
	void autoEnableOnStartup(context, target, branding);
}

async function autoEnableOnStartup(
	context: vscode.ExtensionContext,
	target: ExtensionTarget,
	branding: Branding,
): Promise<void> {
	// Don't ever block activation.
	try {
		if (target.hostName !== "Cursor") {
			registerVsCodeMcpServerProvider(context);
		}

		const key = disabledUntilKey(target.hostName);
		const disabledAt = context.globalState.get<number>(key);
		if (!shouldAutoEnable(disabledAt, Date.now())) {
			return;
		}
		await context.globalState.update(key, undefined);

		const hookHealth = await target.installer.getHookHealth({ context }).catch(() => null);
		const hasManagedHooks = !!hookHealth && hookHealth.installedEvents.length > 0;
		if (!hasManagedHooks) {
			await target.installer.installManagedHooks({ context }, branding);
		}

		if (target.hostName === "Cursor") {
			await installCursorMcpServer(context);
		}

		const shownKey = `sage.autoEnabledShown.${target.hostName}`;
		if (!context.globalState.get<boolean>(shownKey)) {
			await context.globalState.update(shownKey, true);
			void vscode.window.showInformationMessage(
				`${branding.short_name}: Protection auto-enabled for ${target.hostName}. Disable via "${branding.short_name}: Disable protection until restart".`,
			);
		}
	} catch {
		// Fail-open: never block extension activation.
	}
}

async function ensureFile(filePath: string, content: string): Promise<void> {
	try {
		await access(filePath);
	} catch {
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, content, "utf8");
	}
}

function withErrorBoundary(branding: Branding) {
	return async (work: () => Promise<void>): Promise<void> => {
		try {
			await work();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(`${branding.short_name}: ${message}`);
		}
	};
}

/** Extracts brand IDs from manifest `when` clauses generated by `scripts/generate-brand-commands.mjs`. */
function extractKnownBrandsFromManifest(context: vscode.ExtensionContext): Set<string> {
	const pkg = context.extension.packageJSON as Record<string, unknown>;
	const contributes = pkg.contributes as Record<string, unknown> | undefined;
	const menus = contributes?.menus as Record<string, unknown> | undefined;
	const palette = (menus?.commandPalette ?? []) as Array<{ when?: string }>;
	const brands = new Set<string>();
	for (const entry of palette) {
		const match = entry.when?.match(/sage\.brandKey\s*==\s*'([^']+)'/);
		if (match?.[1]) brands.add(match[1]);
	}
	return brands;
}

function setupStatusFileWatcher(context: vscode.ExtensionContext, branding: Branding): void {
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
					void vscode.window.showErrorMessage(
						`${branding.short_name} blocked: ${reason} (${category})`,
					);
				} else if (data.flagged > prev.flagged) {
					const reason = data.lastReason ?? "Action flagged";
					const category = data.lastCategory ?? "unknown";
					void vscode.window.showWarningMessage(
						`${branding.short_name} flagged: ${reason} (${category})`,
					);
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
