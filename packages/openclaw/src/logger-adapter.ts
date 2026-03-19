/**
 * Bridges OpenClaw's PluginLogger to Sage's Logger interface.
 */

import type { Logger } from "@gendigital/sage-core";

/** Mirrors OpenClaw's PluginLogger type without importing it. */
export interface PluginLogger {
	debug?(msg: string): void;
	info(msg: string): void;
	warn(msg: string): void;
	error(msg: string): void;
}

export function createLogger(pluginLogger: PluginLogger): Logger {
	function formatMessage(msg: string, data?: unknown): string {
		return data ? `${msg} ${JSON.stringify(data)}` : msg;
	}

	return {
		debug(msg, data?) {
			pluginLogger.debug?.(formatMessage(msg, data));
		},
		info(msg, data?) {
			pluginLogger.info(formatMessage(msg, data));
		},
		warn(msg, data?) {
			pluginLogger.warn(formatMessage(msg, data));
		},
		error(msg, data?) {
			pluginLogger.error(formatMessage(msg, data));
		},
	};
}
