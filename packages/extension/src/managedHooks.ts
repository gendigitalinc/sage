import type * as vscode from "vscode";

export interface ManagedHookInstallOptions {
	context: vscode.ExtensionContext;
}

export interface ManagedHookHealth {
	configPath: string;
	runnerPath: string | undefined;
	installedEvents: string[];
	managedCommands: string[];
}
