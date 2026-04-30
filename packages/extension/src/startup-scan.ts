import { homedir } from "node:os";
import { join } from "node:path";

import {
	type Branding,
	createScanHandler as coreScanHandler,
	defaultBranding,
	type Logger,
} from "@gendigital/sage-core";
import type * as vscode from "vscode";
import { discoverExtensionPlugins } from "./plugin-discovery.js";

export function createExtensionScanHandler(
	context: vscode.ExtensionContext,
	hostName: string,
	logger: Logger,
	branding: Branding = defaultBranding,
	onResult?: (msg: string) => void,
): () => Promise<void> {
	const extensionsDir =
		hostName === "Cursor"
			? join(homedir(), ".cursor", "extensions")
			: join(homedir(), ".vscode", "extensions");

	const threatsDir = join(context.extensionPath, "resources", "threats");
	const allowlistsDir = join(context.extensionPath, "resources", "allowlists");
	const version =
		((context.extension.packageJSON as Record<string, unknown>).version as string) ?? "0.0.0";
	const selfPrefix = `${(context.extension.packageJSON as Record<string, unknown>).name}@`;

	return coreScanHandler({
		logger,
		context: "activation",
		discoverPlugins: () => discoverExtensionPlugins(logger, extensionsDir, branding),
		selfPrefix,
		threatsDir,
		allowlistsDir,
		version,
		agentRuntime: hostName === "Cursor" ? "cursor" : "vscode",
		branding,
		onResult,
		modelDownloadWorkerPath: context.asAbsolutePath(join("dist", "model-download-worker.cjs")),
		// Cursor/VS Code surface the result in `vscode.window.showErrorMessage`,
		// a small toast that wraps badly on multi-line padded output. Compact
		// keeps the notification readable in that envelope while still naming
		// the offending plugin and giving the full path to one finding.
		style: "compact",
	});
}
