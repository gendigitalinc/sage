import type { Branding, Logger } from "@gendigital/sage-core";
import * as vscode from "vscode";

export function createExtensionLogger(branding: Branding): Logger {
	const channel = vscode.window.createOutputChannel(branding.short_name);

	function format(level: string, msg: string, data?: Record<string, unknown>): string {
		const ts = new Date().toISOString();
		const suffix = data ? ` ${JSON.stringify(data)}` : "";
		return `[${ts}] ${level} ${msg}${suffix}`;
	}

	return {
		debug(msg, data?) {
			channel.appendLine(format("DEBUG", msg, data));
		},
		info(msg, data?) {
			channel.appendLine(format("INFO", msg, data));
		},
		warn(msg, data?) {
			channel.appendLine(format("WARN", msg, data));
		},
		error(msg, data?) {
			channel.appendLine(format("ERROR", msg, data));
		},
	};
}
