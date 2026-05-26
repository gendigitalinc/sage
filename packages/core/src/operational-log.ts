/**
 * Shared operational logger.
 * Appends JSON Lines entries to ~/.sage/operational.jsonl for developer diagnostics.
 */

import { appendJsonlEntry } from "./jsonl-log-writer.js";
import type {
	AgentRuntime,
	Logger,
	OperationalLoggingConfig,
	OperationalLogLevel,
	RuntimeOperationalLogger,
} from "./types.js";

const LEVEL_PRIORITY: Record<OperationalLogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};
const FLUSH_TIMEOUT_MS = 250;

export interface OperationalLogEntry {
	timestamp: string;
	level: OperationalLogLevel;
	runtime: AgentRuntime;
	component: string;
	message: string;
	data?: Record<string, unknown>;
}

function shouldLog(config: OperationalLoggingConfig, level: OperationalLogLevel): boolean {
	return config.enabled && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.level];
}

function normalizeData(
	data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!data) return undefined;
	const seen = new WeakSet<object>();
	try {
		return JSON.parse(
			JSON.stringify(data, (_key, value) => {
				if (typeof value === "bigint") return value.toString();
				if (value instanceof Error) {
					return { name: value.name, message: value.message, stack: value.stack };
				}
				if (value && typeof value === "object") {
					if (seen.has(value)) return "[Circular]";
					seen.add(value);
				}
				return value;
			}),
		) as Record<string, unknown>;
	} catch {
		return { serialization_error: "Failed to serialize log data" };
	}
}

async function writeOperationalLogEntry(
	config: OperationalLoggingConfig,
	entry: OperationalLogEntry,
): Promise<void> {
	if (!shouldLog(config, entry.level)) return;

	try {
		await appendJsonlEntry(config, entry);
	} catch {
		// Fail-open: operational logging must never affect runtime behavior.
	}
}

// RuntimeOperationalLogger should be created once per process
export function createOperationalLogger(
	config: OperationalLoggingConfig,
	runtime: AgentRuntime,
): RuntimeOperationalLogger {
	const pendingWrites = new Set<Promise<void>>();

	function log(
		component: string,
		level: OperationalLogLevel,
		message: string,
		data?: Record<string, unknown>,
	): void {
		if (!shouldLog(config, level)) return;
		const entry: OperationalLogEntry = {
			timestamp: new Date().toISOString(),
			level,
			runtime,
			component,
			message,
			...(data ? { data: normalizeData(data) } : {}),
		};
		const write = writeOperationalLogEntry(config, entry);
		pendingWrites.add(write);
		void write.finally(() => pendingWrites.delete(write));
	}

	async function flush() {
		const deadline = Date.now() + FLUSH_TIMEOUT_MS;
		while (pendingWrites.size > 0) {
			const remainingMs = deadline - Date.now();
			if (remainingMs <= 0) return;

			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				const result = await Promise.race([
					Promise.allSettled([...pendingWrites]).then(() => "drained" as const),
					new Promise<"timeout">((resolve) => {
						timeout = setTimeout(() => resolve("timeout"), remainingMs);
						timeout.unref?.();
					}),
				]);
				if (result === "timeout") return;
			} finally {
				if (timeout) clearTimeout(timeout);
			}
		}
	}

	function forComponent(component: string): Logger {
		return {
			debug(msg, data?) {
				log(component, "debug", msg, data);
			},
			info(msg, data?) {
				log(component, "info", msg, data);
			},
			warn(msg, data?) {
				log(component, "warn", msg, data);
			},
			error(msg, data?) {
				log(component, "error", msg, data);
			},
			flush,
		};
	}

	return {
		debug(component, msg, data?) {
			log(component, "debug", msg, data);
		},
		info(component, msg, data?) {
			log(component, "info", msg, data);
		},
		warn(component, msg, data?) {
			log(component, "warn", msg, data);
		},
		error(component, msg, data?) {
			log(component, "error", msg, data);
		},
		forComponent,
		flush,
	};
}
