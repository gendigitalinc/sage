import type * as vscode from "vscode";

import { activateManagedHooksExtension } from "./shared_extension.js";
import * as vscodeHookInstaller from "./vscode_hook_installer.js";

export function activate(context: vscode.ExtensionContext): void {
	activateManagedHooksExtension(context, {
		hostName: "VS Code",
		installer: vscodeHookInstaller,
	});
}

export function deactivate(): void {
	// No background resources to dispose.
}
