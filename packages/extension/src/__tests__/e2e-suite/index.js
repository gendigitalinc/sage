const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vscode = require("vscode");

const REQUIRED_COMMANDS = [
	"sage.enableProtection",
	"sage.disableProtection",
	"sage.openConfig",
	"sage.openAuditLog",
	"sage.showHookHealth",
];

const REQUIRED_CURSOR_EVENTS = [
	"beforeShellExecution",
	"preToolUse",
	"beforeMCPExecution",
	"beforeReadFile",
];

const EXPECTED_PRE_TOOL_USE_MATCHERS = ["Write", "Delete", "Edit", "WebFetch"];

const host = readRequiredEnv("SAGE_E2E_HOST");
const extensionId = readRequiredEnv("SAGE_E2E_EXTENSION_ID");
const managedMarker = readRequiredEnv("SAGE_E2E_MANAGED_MARKER");
const hookMode = readRequiredEnv("SAGE_E2E_HOOK_MODE");
const hooksRelativePath = readRequiredEnv("SAGE_E2E_HOOKS_RELATIVE_PATH");
const hookRunnerPath = readRequiredEnv("SAGE_E2E_HOOK_RUNNER_PATH");
const resultsFilePath = process.env.SAGE_E2E_RESULTS_FILE?.trim() || undefined;
const verbose = isVerbose();

const hookConfigPath = path.join(os.homedir(), hooksRelativePath);
const TEST_CASES = [
	{
		id: "extension-activates",
		name: "extension activates",
		run: verifyExtensionActivation,
	},
	{
		id: "commands-registered",
		name: "sage commands are registered",
		run: verifyCommandsRegistered,
	},
	{
		id: "enable-protection-writes-hooks",
		name: "enable protection writes managed hooks",
		run: verifyEnableProtection,
	},
	{
		id: "hook-health-command",
		name: "hook health command runs without error",
		run: verifyHookHealthCommand,
	},
	{
		id: "dangerous-write-blocked",
		name: "managed hook blocks dangerous write",
		run: verifyHookPipelineBlocksThreat,
	},
	{
		id: "tool-coverage-deny",
		name: "hook denies canary payloads across all tool names",
		run: verifyToolCoverageDeny,
	},
	{
		id: "hook-response-shape-consistent",
		name: "hook responses have consistent shape across event types",
		run: verifyHookResponseShapeAcrossEvents,
	},
	{
		id: "disable-protection-removes-hooks",
		name: "disable protection removes managed hooks",
		run: verifyDisableProtection,
	},
];

async function run() {
	const failures = [];
	const results = [];
	try {
		await configureHookRunner();
		for (const testCase of TEST_CASES) {
			await runCase(testCase, failures, results);
		}
	} finally {
		writeResults(results);
	}

	if (failures.length > 0) {
		throw new Error(
			`Extension host E2E failed (${failures.length} case(s)):\n\n${failures.join("\n\n")}`,
		);
	}
}

module.exports = { run };

async function runCase(testCase, failures, results) {
	const startedAt = Date.now();
	try {
		await testCase.run();
		results.push({
			id: testCase.id,
			name: testCase.name,
			status: "pass",
			durationMs: Date.now() - startedAt,
		});
		if (verbose) {
			console.log(`[sage-e2e] PASS: ${testCase.name}`);
		}
	} catch (error) {
		const details = formatError(error);
		results.push({
			id: testCase.id,
			name: testCase.name,
			status: "fail",
			error: details,
			durationMs: Date.now() - startedAt,
		});
		console.error(`[sage-e2e] FAIL: ${testCase.name}\n${details}`);
		failures.push(`${testCase.name}\n${details}`);
	}
}

async function configureHookRunner() {
	await vscode.workspace
		.getConfiguration()
		.update("sage.hookRunnerPath", hookRunnerPath, vscode.ConfigurationTarget.Global);
}

async function verifyExtensionActivation() {
	const extension = vscode.extensions.getExtension(extensionId);
	assert.ok(extension, `Expected extension "${extensionId}" to be loaded`);
	await extension.activate();
	assert.equal(extension.isActive, true, `Expected extension "${extensionId}" to be active`);
}

async function verifyCommandsRegistered() {
	const commands = await vscode.commands.getCommands(true);
	for (const commandId of REQUIRED_COMMANDS) {
		assert.ok(commands.includes(commandId), `Expected command "${commandId}" to be registered`);
	}
}

async function verifyEnableProtection() {
	await vscode.commands.executeCommand("sage.enableProtection");
	assert.ok(fs.existsSync(hookConfigPath), `Expected hook config at ${hookConfigPath}`);

	const config = readJsonFile(hookConfigPath);
	if (host === "cursor") {
		verifyCursorManagedHooks(config);
	} else {
		verifyVsCodeManagedHooks(config);
	}

	const managedCommands = collectManagedCommands(config);
	assert.ok(managedCommands.length > 0, "Expected at least one managed hook command");
	assert.ok(
		managedCommands.some(
			(command) => command.includes(` ${hookMode} `) || command.endsWith(` ${hookMode}`),
		),
		`Expected managed command to invoke mode "${hookMode}"`,
	);
}

async function verifyHookHealthCommand() {
	await vscode.commands.executeCommand("sage.showHookHealth");
}

async function verifyHookPipelineBlocksThreat() {
	assert.ok(fs.existsSync(hookRunnerPath), `Expected hook runner at ${hookRunnerPath}`);

	const payload =
		hookMode === "cursor"
			? {
					hook_event_name: "preToolUse",
					tool_name: "Write",
					tool_input: {
						file_path: "/tmp/__sage_test_deny_file_e6c4a918__.txt",
						content: "hello",
					},
				}
			: {
					tool_name: "create_file",
					tool_input: {
						filePath: "/tmp/__sage_test_deny_file_e6c4a918__.txt",
						content: "hello",
					},
				};

	const response = runHook(payload);
	if (hookMode === "cursor") {
		assert.equal(response.decision, "deny", "Expected Cursor hook decision=deny");
		assert.equal(response.permission, "deny", "Expected Cursor hook permission=deny");
		assert.ok(
			typeof response.reason === "string",
			"Expected Cursor deny response to include reason",
		);
		return;
	}

	const hookSpecificOutput = asObject(response.hookSpecificOutput);
	const decision = hookSpecificOutput.permissionDecision;
	assert.ok(
		decision === "deny" || decision === "ask",
		`Expected VS Code hook decision deny|ask, got "${String(decision)}"`,
	);
}

/**
 * Verify that the hook runner returns deny for ALL supported tool names.
 *
 * Cursor payloads cover all event types (preToolUse, beforeShellExecution, beforeReadFile).
 * VS Code payloads cover all VS Code Copilot Chat + Copilot CLI tool names.
 *
 * Each payload uses canary patterns from threats/dummy.yaml to trigger a deny verdict.
 */
async function verifyToolCoverageDeny() {
	assert.ok(fs.existsSync(hookRunnerPath), `Expected hook runner at ${hookRunnerPath}`);

	const canaryFilePath = "/tmp/__sage_test_deny_file_e6c4a918__.txt";
	const canaryCommand = "echo __sage_test_deny_cmd_a75bf229__";
	const canaryUrl = "https://sage-canary-deny-4e91ca37.test/page";
	const canaryPatchInput = `*** Update File: ${canaryFilePath}\n--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new`;

	const payloads =
		hookMode === "cursor"
			? [
					{
						label: "Write (preToolUse)",
						payload: {
							hook_event_name: "preToolUse",
							tool_name: "Write",
							tool_input: { file_path: canaryFilePath, content: "hello" },
						},
					},
					{
						label: "Edit (preToolUse)",
						payload: {
							hook_event_name: "preToolUse",
							tool_name: "Edit",
							tool_input: {
								file_path: canaryFilePath,
								old_string: "old",
								new_string: "new",
							},
						},
					},
					{
						label: "Read (preToolUse)",
						payload: {
							hook_event_name: "preToolUse",
							tool_name: "Read",
							tool_input: { file_path: canaryFilePath },
						},
					},
					{
						label: "Delete (preToolUse)",
						payload: {
							hook_event_name: "preToolUse",
							tool_name: "Delete",
							tool_input: { file_path: canaryFilePath },
						},
					},
					{
						label: "WebFetch (preToolUse)",
						payload: {
							hook_event_name: "preToolUse",
							tool_name: "WebFetch",
							tool_input: { url: canaryUrl },
						},
					},
					{
						label: "Shell (beforeShellExecution)",
						payload: {
							hook_event_name: "beforeShellExecution",
							command: canaryCommand,
							cwd: "/tmp",
						},
					},
					{
						label: "Read (beforeReadFile)",
						payload: {
							hook_event_name: "beforeReadFile",
							file_path: canaryFilePath,
							content: "",
							attachments: [],
						},
					},
				]
			: [
					// --- VS Code Copilot Chat tools ---
					{
						label: "run_in_terminal",
						payload: {
							tool_name: "run_in_terminal",
							tool_input: { command: canaryCommand },
						},
					},
					{
						label: "create_file",
						payload: {
							tool_name: "create_file",
							tool_input: { filePath: canaryFilePath, content: "hello" },
						},
					},
					{
						label: "read_file",
						payload: {
							tool_name: "read_file",
							tool_input: { filePath: canaryFilePath },
						},
					},
					{
						label: "replace_string_in_file",
						payload: {
							tool_name: "replace_string_in_file",
							tool_input: {
								filePath: canaryFilePath,
								oldString: "old",
								newString: "new",
							},
						},
					},
					{
						label: "insert_edit_into_file",
						payload: {
							tool_name: "insert_edit_into_file",
							tool_input: { filePath: canaryFilePath, code: "new content" },
						},
					},
					{
						label: "multi_replace_string_in_file",
						payload: {
							tool_name: "multi_replace_string_in_file",
							tool_input: {
								replacements: [{ filePath: canaryFilePath, oldString: "old", newString: "new" }],
							},
						},
					},
					{
						label: "fetch_webpage",
						payload: {
							tool_name: "fetch_webpage",
							tool_input: { urls: [canaryUrl], query: "content" },
						},
					},
					{
						label: "apply_patch (input)",
						payload: {
							tool_name: "apply_patch",
							tool_input: { input: canaryPatchInput },
						},
					},
					// --- Copilot CLI tools ---
					{
						label: "bash",
						payload: {
							tool_name: "bash",
							tool_input: { command: canaryCommand, description: "test" },
						},
					},
					{
						label: "write_bash",
						payload: {
							tool_name: "write_bash",
							tool_input: { shellId: "0", input: canaryCommand, delay: 0 },
						},
					},
					{
						label: "create",
						payload: {
							tool_name: "create",
							tool_input: { path: canaryFilePath, content: "hello" },
						},
					},
					{
						label: "edit",
						payload: {
							tool_name: "edit",
							tool_input: {
								path: canaryFilePath,
								old_string: "old",
								new_string: "new",
							},
						},
					},
					{
						label: "view",
						payload: {
							tool_name: "view",
							tool_input: { path: canaryFilePath },
						},
					},
					{
						label: "grep",
						payload: {
							tool_name: "grep",
							tool_input: { pattern: "test", path: canaryFilePath },
						},
					},
					{
						label: "web_fetch",
						payload: {
							tool_name: "web_fetch",
							tool_input: { url: canaryUrl },
						},
					},
					{
						label: "apply_patch (patch)",
						payload: {
							tool_name: "apply_patch",
							tool_input: { patch: canaryPatchInput },
						},
					},
				];

	const failures = [];
	for (const { label, payload } of payloads) {
		const response = runHook(payload);

		if (hookMode === "cursor") {
			if (response.decision !== "deny" && response.permission !== "deny") {
				failures.push(
					`${label}: expected deny, got decision="${String(response.decision)}" permission="${String(response.permission)}"`,
				);
			}
		} else {
			const hookSpecificOutput = asObject(response.hookSpecificOutput);
			const decision = hookSpecificOutput.permissionDecision;
			if (decision !== "deny" && decision !== "ask") {
				failures.push(
					`${label}: expected deny|ask, got permissionDecision="${String(decision)}" (response: ${JSON.stringify(response)})`,
				);
			}
		}
	}

	assert.equal(
		failures.length,
		0,
		`${failures.length}/${payloads.length} tool(s) failed deny check:\n${failures.join("\n")}`,
	);

	if (verbose) {
		console.log(
			`[sage-e2e] tool-coverage-deny: ${payloads.length}/${payloads.length} tools passed`,
		);
	}
}

async function verifyHookResponseShapeAcrossEvents() {
	if (hookMode !== "cursor") {
		return;
	}

	assert.ok(fs.existsSync(hookRunnerPath), `Expected hook runner at ${hookRunnerPath}`);

	const payloads = [
		{
			event: "preToolUse",
			payload: {
				hook_event_name: "preToolUse",
				tool_name: "Write",
				tool_input: {
					file_path: "/tmp/notes.txt",
					content: "just some notes",
				},
			},
		},
		{
			event: "beforeShellExecution",
			payload: {
				hook_event_name: "beforeShellExecution",
				command: "echo hello",
				cwd: "/tmp",
			},
		},
		{
			event: "beforeReadFile",
			payload: {
				hook_event_name: "beforeReadFile",
				file_path: "/tmp/notes.txt",
				content: "",
				attachments: [],
			},
		},
		{
			event: "beforeMCPExecution",
			payload: {
				hook_event_name: "beforeMCPExecution",
				tool_name: "MCP",
				tool_input: { query: "repo metadata" },
			},
		},
	];

	for (const { event, payload } of payloads) {
		const response = runHook(payload);

		assert.ok(
			"decision" in response,
			`${event}: response missing "decision" field (got keys: ${Object.keys(response).join(", ")})`,
		);
		assert.ok(
			"permission" in response,
			`${event}: response missing "permission" field (got keys: ${Object.keys(response).join(", ")})`,
		);
		assert.equal(
			response.decision,
			response.permission,
			`${event}: "decision" (${String(response.decision)}) and "permission" (${String(response.permission)}) must match`,
		);
	}
}

async function verifyDisableProtection() {
	await vscode.commands.executeCommand("sage.disableProtection");
	if (!fs.existsSync(hookConfigPath)) {
		return;
	}

	const config = readJsonFile(hookConfigPath);
	const managedCommands = collectManagedCommands(config);
	assert.equal(managedCommands.length, 0, "Expected no managed hook commands after disable");
}

function verifyCursorManagedHooks(config) {
	const hooks = asObject(config.hooks);
	for (const eventName of REQUIRED_CURSOR_EVENTS) {
		const entries = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
		const managedEntry = entries.find(
			(entry) =>
				entry &&
				typeof entry === "object" &&
				typeof entry.command === "string" &&
				entry.command.includes(managedMarker),
		);
		assert.ok(managedEntry, `Expected managed Cursor hook for event "${eventName}"`);

		if (eventName === "preToolUse" && managedEntry) {
			const matcher = typeof managedEntry.matcher === "string" ? managedEntry.matcher : "";
			for (const tool of EXPECTED_PRE_TOOL_USE_MATCHERS) {
				assert.ok(
					matcher.includes(tool),
					`preToolUse matcher "${matcher}" missing expected tool "${tool}"`,
				);
			}
		}
	}
}

function verifyVsCodeManagedHooks(config) {
	const hooks = asObject(config.hooks);
	const preToolUse = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse : [];
	assert.ok(preToolUse.length > 0, "Expected PreToolUse entries in Copilot hooks");

	const hasManagedCommand = preToolUse.some(
		(entry) =>
			entry &&
			typeof entry === "object" &&
			entry.type === "command" &&
			typeof entry.command === "string" &&
			entry.command.includes(managedMarker),
	);
	assert.ok(hasManagedCommand, "Expected managed command hook in Copilot PreToolUse entries");
}

function collectManagedCommands(config) {
	const hooks = asObject(config.hooks);
	const commands = [];
	for (const entries of Object.values(hooks)) {
		if (!Array.isArray(entries)) {
			continue;
		}
		for (const entry of entries) {
			if (
				entry &&
				typeof entry === "object" &&
				typeof entry.command === "string" &&
				entry.command.includes(managedMarker)
			) {
				commands.push(entry.command);
			}
		}
	}
	return commands;
}

function runHook(payload) {
	const nodePath = process.env.VSCODE_NODE_EXEC_PATH || process.execPath;
	const options = {
		encoding: "utf8",
		input: `${JSON.stringify(payload)}`,
		env: {
			...process.env,
			ELECTRON_RUN_AS_NODE: "1",
		},
	};
	const stdout = execFileSync(nodePath, [hookRunnerPath, hookMode], options);
	return parseHookStdout(stdout);
}

function parseHookStdout(stdout) {
	if (!stdout.trim()) {
		return {};
	}
	return JSON.parse(stdout.trim());
}

function readJsonFile(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readRequiredEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function formatError(error) {
	if (error instanceof Error) {
		return error.stack || error.message;
	}
	return String(error);
}

function writeResults(results) {
	if (!resultsFilePath) {
		return;
	}

	try {
		fs.writeFileSync(
			resultsFilePath,
			`${JSON.stringify(
				{
					host,
					generatedAt: new Date().toISOString(),
					cases: results,
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
	} catch (error) {
		if (verbose) {
			console.error(`[sage-e2e] Failed to write case results: ${formatError(error)}`);
		}
	}
}

function isVerbose() {
	const value = process.env.SAGE_E2E_VERBOSE?.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes" || value === "on";
}
