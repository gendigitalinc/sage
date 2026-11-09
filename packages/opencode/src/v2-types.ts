/**
 * Local structural types for the OpenCode v2 plugin API.
 *
 * Structural subset of the OpenCode v2 Promise plugin API, checked against
 * the 2.1.4 server plugin documentation. Declared locally so the package can
 * retain its v1 SDK dependency. Re-check these shapes when updating v2 support.
 */

/** OpenCode v2 version these types were last checked against. */
export const V2_SDK_TYPES_VERSION = "2.1.4";

export interface V2Registration {
	readonly dispose: () => Promise<void>;
}

/** Subset of v2 `ToolContext` passed to tool `execute`. */
export interface V2ToolContext {
	readonly sessionID: string;
	readonly agent: string;
	readonly messageID: string;
	readonly id: string;
	readonly [key: string]: unknown;
}

export interface V2ToolResult {
	content?: unknown;
	metadata?: Record<string, unknown>;
}

export interface V2PermissionEvaluation {
	readonly action: string;
	effect: "allow" | "ask" | "deny";
}

export interface V2PermissionAssertInput {
	readonly sessionID: string;
	readonly agent: string;
	readonly source: { readonly type: "tool"; readonly messageID: string; readonly id: string };
	readonly action: string;
	readonly resources: readonly string[];
	readonly save: readonly string[];
}

export interface V2ToolInfo {
	readonly name?: string;
	readonly description: string;
	readonly input: unknown;
	readonly options?: { readonly codemode?: boolean };
	readonly execute: (input: unknown, context: V2ToolContext) => Promise<V2ToolResult>;
}

export interface V2ToolEditor {
	get(id: string): V2ToolInfo | undefined;
	add(tool: V2ToolInfo): void;
}

export interface V2McpEditor {
	get(name: string): unknown;
	set(name: string, config: Record<string, unknown>): void;
}

export interface V2ToolExecuteBefore {
	tool: string;
	readonly sessionID: string;
	readonly id: string;
	input: unknown;
}

/** Structural subset of the v2 promise plugin `Context` Sage relies on. */
export interface V2PluginContext {
	readonly location?: { readonly directory?: string };
	readonly tool: {
		readonly transform: (callback: (editor: V2ToolEditor) => void) => Promise<V2Registration>;
		readonly hook: (
			name: "execute.before",
			callback: (event: V2ToolExecuteBefore) => Promise<void> | void,
		) => Promise<V2Registration>;
	};
	readonly permission: {
		readonly assert: (input: V2PermissionAssertInput) => Promise<void>;
		readonly hook: (
			name: "evaluate",
			callback: (event: V2PermissionEvaluation) => Promise<void> | void,
		) => Promise<V2Registration>;
	};
	readonly mcp?: {
		readonly transform: (callback: (editor: V2McpEditor) => void) => Promise<V2Registration>;
	};
	readonly session?: {
		readonly hook: (
			name: "prompt",
			callback: (event: { readonly sessionID: string }) => Promise<void> | void,
		) => Promise<V2Registration>;
	};
	/** Not part of the v2 server context today; used if a future host exposes it. */
	readonly toast?: {
		show(options: { title?: string; message: string; variant?: string; duration?: number }): void;
	};
}
