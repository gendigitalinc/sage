/**
 * Maps pi tool inputs to sage artifacts.
 *
 * Schemas verified against pi 1.0.4
 * (`pi/packages/coding-agent/src/core/tools/*.ts`). `tool_call` handlers
 * receive the arguments after the tool's `prepareArguments` and schema
 * validation (`pi/packages/agent/src/agent-loop.ts` `prepareToolCall`), so
 * `edit` always arrives as `{ path, edits: [{ oldText, newText }] }` — legacy
 * top-level `oldText`/`newText` and stringified `edits` are already folded in.
 *
 * Coverage policy: every built-in tool capable of executing code or
 * reading/writing files emits at least one artifact. Search/listing tools
 * (grep, find, ls) emit none — sage's evaluator short-circuits to `allow` on
 * `artifacts.length === 0`. Codemode scripts run in a QuickJS sandbox with no
 * Node, file system, or network access; the tools they call fire their own
 * `tool_call` events and are evaluated there.
 */

import {
	type Artifact,
	canonicalizeToolName,
	extractFromBash,
	extractFromEdit,
	extractFromRead,
	extractFromWrite,
	extractUrls,
	type HookToolMapping,
} from "@gendigital/sage-core";

/**
 * Translate a pi tool call into the artifacts sage evaluates, the canonical
 * `toolInput` keys core reads, and the canonical tool label:
 *   command    → AMSI, package extraction from commands
 *   file_path  → AMSI name, package manifest, audit/telemetry
 *   content    → AMSI (Write), package manifest
 *   new_string → AMSI (Edit), package manifest (post-change text only)
 *
 * Rule matching keys off `match_on` (command/file_path/url/content), not the
 * tool label, so the label only affects audit/telemetry. Unknown tools map to
 * no artifacts and pass their input through: the handler short-circuits
 * before the shape matters.
 */
export function mapToolCall(toolName: string, input: Record<string, unknown>): HookToolMapping {
	switch (toolName) {
		case "bash":
		case "powershell": {
			// pi's powershell tool shares bash's `{ command, timeout? }` schema.
			const command = stringOrEmpty(input.command);
			return {
				toolName: "Bash",
				toolInput: { command },
				artifacts: command.length > 0 ? extractFromBash(command) : [],
			};
		}
		case "write": {
			const toolInput = {
				file_path: stringOrEmpty(input.path),
				content: stringOrEmpty(input.content),
			};
			return { toolName: "Write", toolInput, artifacts: extractFromWrite(toolInput) };
		}
		case "edit": {
			const file_path = stringOrEmpty(input.path);
			const { added, removed } = collectEditText(input);
			return {
				toolName: "Edit",
				toolInput: { file_path, new_string: added.join("\n") },
				// Pre-change text is scanned too: URLs in removed content may still be
				// attacker-controlled supply-chain text the agent was asked to touch.
				artifacts: extractFromEdit({ file_path, new_string: [...added, ...removed].join("\n") }),
			};
		}
		case "read": {
			const toolInput = { file_path: stringOrEmpty(input.path) };
			return { toolName: "Read", toolInput, artifacts: extractFromRead(toolInput) };
		}
		case "gui_targets": {
			return { toolName: "Unknown", toolInput: input, artifacts: [] };
		}
		case "gui_act": {
			const artifacts: Artifact[] = [];
			const action = input.action;
			if (action && typeof action === "object") {
				const actionObj = action as Record<string, unknown>;
				if (actionObj.kind === "set_text" && typeof actionObj.text === "string") {
					const urls = extractUrls(actionObj.text);
					for (const url of urls) {
						artifacts.push({ type: "url", value: url });
					}
				}
			}
			return { toolName: "Unknown", toolInput: input, artifacts };
		}
		default:
			return { toolName: canonicalizeToolName({}, toolName), toolInput: input, artifacts: [] };
	}
}

function stringOrEmpty(value: unknown): string {
	return typeof value === "string" ? value : "";
}

/** Splits `edits[]` into replacement (`newText`) and anchor (`oldText`) text. */
function collectEditText(input: Record<string, unknown>): { added: string[]; removed: string[] } {
	const added: string[] = [];
	const removed: string[] = [];
	if (!Array.isArray(input.edits)) return { added, removed };
	for (const raw of input.edits) {
		if (!raw || typeof raw !== "object") continue;
		const entry = raw as Record<string, unknown>;
		if (typeof entry.newText === "string") added.push(entry.newText);
		if (typeof entry.oldText === "string") removed.push(entry.oldText);
	}
	return { added, removed };
}
