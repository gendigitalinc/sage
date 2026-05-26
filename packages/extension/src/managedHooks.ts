import type * as vscode from "vscode";

export interface ManagedHookInstallOptions {
	context: vscode.ExtensionContext;
}

export interface ManagedHookHealth {
	configPath: string;
	runnerPath: string | undefined;
	installedEvents: string[];
	managedCommands: string[];
	/** True iff the on-disk shim already references the current runner path. */
	shimCurrent: boolean;
}
