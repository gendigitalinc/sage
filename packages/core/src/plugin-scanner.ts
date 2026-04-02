/**
 * Plugin scanner — discovers and scans installed Claude Code plugins for threats.
 */

import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { FileCheckClient } from "./clients/file-check.js";
import { UrlCheckClient } from "./clients/url-check.js";
import { extractUrls } from "./extractors.js";
import { getFileContent, getFileContentRaw, getHomeDir } from "./file-utils.js";
import { HeuristicsEngine } from "./heuristics.js";
import type {
	Artifact,
	Logger,
	PluginInfo,
	PluginScanResult,
	Threat,
	TrustedDomain,
} from "./types.js";
import { nullLogger } from "./types.js";

const DEFAULT_PLUGINS_REGISTRY = join(getHomeDir(), ".claude", "plugins", "installed_plugins.json");

const SCANNABLE_EXTENSIONS = new Set([
	".py",
	".js",
	".ts",
	".mjs",
	".mts",
	".sh",
	".bash",
	".zsh",
	".json",
	".yaml",
	".yml",
	".md",
	".toml",
	".txt",
	".cfg",
	".ini",
	".conf",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", "__pycache__"]);

/** Max file size to scan (skip large files). */
const MAX_FILE_SIZE = 512 * 1024;

export async function discoverPlugins(
	registryPath = DEFAULT_PLUGINS_REGISTRY,
	logger: Logger = nullLogger,
): Promise<PluginInfo[]> {
	let raw: string;
	try {
		raw = await getFileContent(registryPath);
	} catch {
		logger.debug("Plugin registry not found", { path: registryPath });
		return [];
	}

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(raw) as Record<string, unknown>;
	} catch (e) {
		logger.warn("Failed to read plugin registry", { error: String(e) });
		return [];
	}

	const plugins: PluginInfo[] = [];
	const pluginEntries = (data.plugins ?? {}) as Record<string, unknown>;

	for (const [pluginKey, versions] of Object.entries(pluginEntries)) {
		if (!Array.isArray(versions) || versions.length === 0) continue;
		const entry = versions[versions.length - 1] as Record<string, unknown>;
		const installPath = (entry.installPath ?? "") as string;
		const version = (entry.version ?? "unknown") as string;
		const lastUpdated = (entry.lastUpdated ?? "") as string;

		if (!installPath) continue;

		plugins.push({ key: pluginKey, installPath, version, lastUpdated });
	}

	return plugins;
}

async function walkPluginFiles(installPath: string, logger: Logger): Promise<string[]> {
	const files: string[] = [];

	async function walk(dirOrFile: string): Promise<void> {
		let stats: Awaited<ReturnType<typeof stat>>;
		try {
			stats = await stat(dirOrFile);
		} catch {
			return;
		}
		// Handle file: check if scannable and add to results
		if (stats.isFile()) {
			if (
				SCANNABLE_EXTENSIONS.has(extname(dirOrFile).toLowerCase()) &&
				stats.size <= MAX_FILE_SIZE
			) {
				files.push(dirOrFile);
			}
			return;
		}
		// Handle directory: recursively walk entries
		if (stats.isDirectory()) {
			let entries: string[];
			try {
				entries = await readdir(dirOrFile);
			} catch {
				return;
			}
			for (const entry of entries) {
				if (SKIP_DIRS.has(entry)) continue;
				const fullPath = join(dirOrFile, entry);
				await walk(fullPath);
			}
		}
	}
	try {
		await walk(installPath);
	} catch (e) {
		logger.warn(`Error walking plugin path ${installPath}`, { error: String(e) });
	}
	return files;
}

/**
 * Returns true if the line is an echo/printf statement where all pipe characters
 * are inside quotes (i.e., just printing text, not piping to another command).
 */
function isHarmlessEcho(line: string): boolean {
	if (!/^(echo|printf)\b/.test(line)) return false;
	// Strip quoted strings, then check for remaining unquoted pipes
	const withoutQuotes = line.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "");
	return !withoutQuotes.includes("|");
}

const JS_TS_EXTENSIONS = new Set([".js", ".ts", ".mjs", ".mts"]);

/**
 * Strip JS/TS comments while preserving string literals.
 * Uses a single-pass regex that matches strings, template literals, and
 * comments. Only comments are replaced; strings are kept intact so that
 * `//` inside URLs (e.g. "https://...") is not misidentified as a comment.
 */
const STRING_OR_COMMENT_RE =
	/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|\/\*[\s\S]*?\*\//gm;

function stripJsComments(src: string): string {
	return src.replace(STRING_OR_COMMENT_RE, (match) => {
		// Keep strings/templates, blank out comments
		if (match.startsWith("//") || match.startsWith("/*")) return "";
		return match;
	});
}

/**
 * Regex patterns for Node.js/Bun/zx command execution APIs.
 * Each captures the string argument (group 1) from known call sites.
 *
 * String literal sub-patterns are escape-aware ("((?:[^"\\]|\\.)+)") so
 * that escaped quotes inside arguments (e.g. exec("bash -c \"curl ...\""))
 * don't truncate the capture.
 */

// Reusable fragment: capture content of "...", '...', or `...`
// Groups: 1 = double-quoted, 2 = single-quoted, 3 = backtick-quoted
const STR_ARG = `(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)'|` + "`([^`]*)`" + `)`;

// exec("..."), execSync("..."), execFile("..."), execFileSync("...")
const JS_EXEC_RE = new RegExp(`\\bexec(?:File)?(?:Sync)?\\s*\\(\\s*${STR_ARG}`, "g");

// spawn("..."), spawnSync("...") — first arg is the executable
const JS_SPAWN_RE = new RegExp(`\\bspawn(?:Sync)?\\s*\\(\\s*${STR_ARG}`, "g");

// spawn/spawnSync array args: spawn("bash", ["-c", "curl ..."])
// Captures the executable (group 1/2/3) and array content (group 4).
const JS_SPAWN_ARGS_RE =
	/\bspawn(?:Sync)?\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`)\s*,\s*\[([^\]]*)\]/g;

// Only extract array args when the executable is a shell — otherwise the
// args are just data passed to the program, not commands to execute.
// Checked by basename so path-qualified forms like /bin/bash also match.
const SHELL_EXECUTABLES = new Set([
	"bash",
	"sh",
	"zsh",
	"dash",
	"ksh",
	"csh",
	"fish",
	"cmd",
	"cmd.exe",
	"powershell",
	"powershell.exe",
	"pwsh",
]);

function isShellExecutable(exe: string): boolean {
	const basename = exe.split("/").pop()?.split("\\").pop() ?? exe;
	return SHELL_EXECUTABLES.has(basename);
}

// execa("...")
const JS_EXECA_RE = new RegExp(`\\bexeca\\s*\\(\\s*${STR_ARG}`, "g");

// execa array args: execa("bash", ["-c", "curl ..."])
const JS_EXECA_ARGS_RE =
	/\bexeca\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`)\s*,\s*\[([^\]]*)\]/g;

// Bun.shell("...")
const JS_BUN_SHELL_RE = new RegExp(`\\bBun\\.shell\\s*\\(\\s*${STR_ARG}`, "g");

// Bun.$`...`
const JS_BUN_DOLLAR_RE = /\bBun\.\$`([^`]+)`/g;

// $`...` (zx tagged template)
const JS_ZX_RE = /(?<!\w)\$`([^`]+)`/g;

/**
 * Extract command artifacts from JS/TS file content.
 *
 * Known limitation: matching runs on flattened source text after comment
 * stripping, so API-call patterns appearing inside string literals (e.g.
 * help text or documentation examples) will produce false-positive artifacts.
 * In practice this is low-risk because the artifact must still match a threat
 * pattern to trigger a finding.
 */
export function extractCommandsFromJsTs(content: string, fileName: string): Artifact[] {
	const commands = new Set<string>();
	const stripped = stripJsComments(content);
	// Collapse newlines to spaces so multi-line calls are matched
	const collapsed = stripped.replace(/\n/g, " ");

	function addMatch(m: RegExpExecArray) {
		// Capture group 1, 2, or 3 (double, single, or backtick quotes)
		const val = m[1] ?? m[2] ?? m[3];
		if (val) commands.add(val.trim());
	}

	for (const re of [JS_EXEC_RE, JS_SPAWN_RE, JS_EXECA_RE, JS_BUN_SHELL_RE]) {
		for (const m of collapsed.matchAll(re)) {
			addMatch(m);
		}
	}

	// Bun.$`...` and $`...` — single capture group
	for (const re of [JS_BUN_DOLLAR_RE, JS_ZX_RE]) {
		for (const m of collapsed.matchAll(re)) {
			if (m[1]) commands.add(m[1].trim());
		}
	}

	// spawn/spawnSync/execa array args — only extract when the executable is a shell
	for (const re of [JS_SPAWN_ARGS_RE, JS_EXECA_ARGS_RE]) {
		for (const arrMatch of collapsed.matchAll(re)) {
			const exe = (arrMatch[1] ?? arrMatch[2] ?? arrMatch[3] ?? "").trim();
			if (!isShellExecutable(exe)) continue;
			const arrayContent = arrMatch[4] ?? "";
			const strLitRe = new RegExp(STR_ARG, "g");
			for (const strMatch of arrayContent.matchAll(strLitRe)) {
				const val = strMatch[1] ?? strMatch[2] ?? strMatch[3];
				if (val) commands.add(val.trim());
			}
		}
	}

	return [...commands].map((value) => ({
		type: "command" as const,
		value,
		context: `plugin_file:${fileName}`,
	}));
}

function extractArtifactsFromFile(filePath: string, content: string): Artifact[] {
	const artifacts: Artifact[] = [];
	const fileName = filePath.split("/").pop() ?? filePath;

	// Extract URLs (skip localhost)
	for (const url of extractUrls(content)) {
		if (url.includes("://127.0.0.1") || url.includes("://localhost")) continue;
		artifacts.push({ type: "url", value: url, context: `plugin_file:${fileName}` });
	}

	// For script files, treat content as potential commands
	const ext = extname(filePath).toLowerCase();
	if ([".sh", ".bash", ".zsh", ".py"].includes(ext)) {
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (
				trimmed &&
				!trimmed.startsWith("#") &&
				!trimmed.startsWith("//") &&
				!isHarmlessEcho(trimmed)
			) {
				artifacts.push({
					type: "command",
					value: trimmed,
					context: `plugin_file:${fileName}`,
				});
			}
		}
	}

	// For JS/TS files, extract commands from known execution APIs
	if (JS_TS_EXTENSIONS.has(ext)) {
		artifacts.push(...extractCommandsFromJsTs(content, fileName));
	}

	return artifacts;
}

export async function scanPlugin(
	plugin: PluginInfo,
	threats: Threat[],
	options: {
		checkUrls?: boolean;
		checkFileHashes?: boolean;
		trustedDomains?: TrustedDomain[];
		logger?: Logger;
	} = {},
): Promise<PluginScanResult> {
	const { checkUrls = true, checkFileHashes = true, trustedDomains, logger = nullLogger } = options;
	const result: PluginScanResult = { plugin, findings: [] };

	const files = await walkPluginFiles(plugin.installPath, logger);
	if (files.length === 0) return result;

	// Only run command-type heuristics on plugin files
	const commandThreats = threats.filter((t) => t.matchOn.has("command"));
	const heuristics = new HeuristicsEngine(commandThreats, trustedDomains);

	const allUrls: string[] = [];
	const hashToFiles = new Map<string, string[]>();

	for (const filePath of files) {
		let content: string;
		let rawBytes: Buffer;
		try {
			rawBytes = await getFileContentRaw(filePath);
			content = rawBytes.toString("utf-8");
		} catch {
			continue;
		}

		// Heuristic matching
		const artifacts = extractArtifactsFromFile(filePath, content);
		if (artifacts.length > 0) {
			const matches = heuristics.match(artifacts);
			for (const match of matches) {
				result.findings.push({
					threatId: match.threat.id,
					title: match.threat.title,
					severity: match.threat.severity,
					confidence: match.threat.confidence,
					action: match.threat.action,
					artifact: match.artifact.slice(0, 200),
					sourceFile: relative(plugin.installPath, filePath),
				});
			}
		}

		// Collect URLs for URL check
		if (checkUrls) {
			allUrls.push(...extractUrls(content));
		}

		// Compute file hash for reputation check
		if (checkFileHashes) {
			const sha256 = createHash("sha256").update(rawBytes).digest("hex");
			const existing = hashToFiles.get(sha256);
			if (existing) {
				existing.push(filePath);
			} else {
				hashToFiles.set(sha256, [filePath]);
			}
		}
	}

	// Run URL check and file hash check in parallel
	const urlCheckPromise =
		checkUrls && allUrls.length > 0
			? (async () => {
					try {
						const uniqueUrls = [...new Set(allUrls)];
						const client = new UrlCheckClient();
						const checkResults = await client.checkUrls(uniqueUrls);
						for (const ur of checkResults) {
							if (ur.isMalicious) {
								const findingDetails = ur.findings
									.map((f) => `${f.severityName}/${f.typeName}`)
									.join(", ");
								result.findings.push({
									threatId: "URL_CHECK",
									title: `Malicious URL (${findingDetails})`,
									severity: "critical",
									confidence: 1.0,
									action: "block",
									artifact: ur.url.slice(0, 200),
									sourceFile: "URL check",
								});
							}
						}
					} catch {
						// Fail open
					}
				})()
			: Promise.resolve();

	const fileCheckPromise =
		checkFileHashes && hashToFiles.size > 0
			? (async () => {
					try {
						const client = new FileCheckClient();
						const uniqueHashes = [...hashToFiles.keys()];
						const checkResults = await client.checkHashes(uniqueHashes);
						for (const fr of checkResults) {
							if (fr.severity === "SEVERITY_MALWARE") {
								const filePaths = hashToFiles.get(fr.sha256) ?? [];
								for (const filePath of filePaths) {
									result.findings.push({
										threatId: "FILE_CHECK",
										title: `Malicious file (${fr.detectionNames.join(", ") || "unknown"})`,
										severity: "critical",
										confidence: 1.0,
										action: "block",
										artifact: fr.sha256,
										sourceFile: relative(plugin.installPath, filePath),
									});
								}
							}
						}
					} catch {
						// Fail open
					}
				})()
			: Promise.resolve();

	await Promise.all([urlCheckPromise, fileCheckPromise]);

	return result;
}
