import type * as vscode from "vscode";
import * as cursorHookInstaller from "./cursor_hook_installer.js";
import { activateManagedHooksExtension } from "./shared_extension.js";

export function activate(context: vscode.ExtensionContext): void {
	activateManagedHooksExtension(context, {
		hostName: "Cursor",
		installer: cursorHookInstaller,
	});
}

export function deactivate(): void {
	// No background resources to dispose.
}
