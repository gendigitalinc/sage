/**
 * Discovers installed OpenCode plugins for plugin scanning.
 * Scans NPM packages from config files and local plugin files.
 */

import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Branding, Logger, PluginInfo, SkillRoot } from "@gendigital/sage-core";
import {
	defaultBranding,
	discoverLooseSkillsAcrossRoots,
	getFileContent,
	getHomeDir,
} from "@gendigital/sage-core";

/** Resolve XDG base directories with fallbacks to homedir defaults */
function getConfigHome(): string {
	return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

function getCacheHome(): string {
	return process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
}

const PROJECT_CONFIG_NAME = "opencode.json";

/** Local plugin directory names OpenCode loads inside its config directories. */
const LOCAL_PLUGIN_DIRS = ["plugins", "plugin"];

/**
 * Loose-skill roots OpenCode loads, at both scopes. Global (personal) skills
 * live under the user profile; project skills live inside the project dir.
 * OpenCode reads its own `opencode` family plus Claude- and agent-compatible
 * families; each is scanned so a malicious skill in any load path is covered.
 * The global `opencode` root is XDG-based (`~/.config/opencode/skills`), not
 * `~/.opencode/skills`. The `scope` key segment keeps a personal and project
 * skill of the same family from colliding in the scan cache.
 */
function resolveSkillRoots(projectDir?: string): SkillRoot[] {
	const roots: SkillRoot[] = [
		{ dir: join(getConfigHome(), "opencode", "skills"), tag: "opencode", scope: "personal" },
		{ dir: join(getHomeDir(), ".claude", "skills"), tag: "claude", scope: "personal" },
		{ dir: join(getHomeDir(), ".agents", "skills"), tag: "agents", scope: "personal" },
	];
	if (projectDir) {
		roots.push(
			{ dir: join(projectDir, ".opencode", "skills"), tag: "opencode", scope: "project" },
			{ dir: join(projectDir, ".claude", "skills"), tag: "claude", scope: "project" },
			{ dir: join(projectDir, ".agents", "skills"), tag: "agents", scope: "project" },
		);
	}
	return roots;
}

/**
 * Discover OpenCode plugins from all sources:
 * 1. NPM packages from config files
 * 2. Local plugin files (global + project)
 * 3. Loose skills (global + project) as pseudo-plugins
 */
export async function discoverOpenCodePlugins(
	logger: Logger,
	projectDir?: string,
	branding: Branding = defaultBranding,
): Promise<PluginInfo[]> {
	logger.debug(`${branding.name} plugin discovery: scanning OpenCode plugins`);

	const plugins: PluginInfo[] = [];

	// 1. Discover NPM plugins from config files
	const npmPlugins = await discoverNpmPlugins(logger, projectDir);
	plugins.push(...npmPlugins);

	// 2. Discover local plugin files (global). OpenCode globs both `plugins/`
	// and `plugin/` inside its config directories.
	for (const dirName of LOCAL_PLUGIN_DIRS) {
		const globalPluginsDir = join(getConfigHome(), "opencode", dirName);
		plugins.push(...(await discoverLocalPlugins(globalPluginsDir, "global", logger)));
	}

	// 3. Discover local plugin files (project)
	if (projectDir) {
		for (const dirName of LOCAL_PLUGIN_DIRS) {
			const projectPluginsDir = join(projectDir, ".opencode", dirName);
			plugins.push(...(await discoverLocalPlugins(projectPluginsDir, "project", logger)));
		}
	}

	// 4. Discover loose skills as pseudo-plugins (deduped by resolved path,
	// fails open per root) so the scan pipeline covers skills installed outside
	// any plugin.
	const skills = await discoverLooseSkillsAcrossRoots(resolveSkillRoots(projectDir));
	plugins.push(...skills);

	logger.debug(`${branding.name} plugin discovery: found ${plugins.length} plugin(s)`);
	return plugins;
}

/** Plugin specs that point at local files rather than npm packages. */
function isPathSpec(spec: string): boolean {
	return (
		spec.startsWith("file:") ||
		spec.startsWith("./") ||
		spec.startsWith("../") ||
		spec.startsWith("/") ||
		spec.startsWith("~")
	);
}

/**
 * NPM package names from an `opencode.json`. OpenCode v1 lists plugins under
 * `plugin` (`"name"` or `["name", options]`); v2 uses `plugins` (`"name"` or
 * `{ package: "name", options }`). Both keys are read so either host's config
 * is covered. Malformed entries and local file specs are ignored.
 */
export function configPluginNames(config: Record<string, unknown>): string[] {
	const names: string[] = [];
	for (const key of ["plugin", "plugins"]) {
		const entries = config[key];
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			let spec: unknown = entry;
			if (Array.isArray(entry)) spec = entry[0];
			else if (entry && typeof entry === "object") spec = (entry as { package?: unknown }).package;
			if (typeof spec === "string" && spec && !isPathSpec(spec)) names.push(spec);
		}
	}
	return names;
}

/**
 * Discover NPM plugins listed in config files
 */
async function discoverNpmPlugins(logger: Logger, projectDir?: string): Promise<PluginInfo[]> {
	const plugins: PluginInfo[] = [];
	const pluginNames = new Set<string>();

	// Read global config
	try {
		const globalConfigPath = join(getConfigHome(), "opencode", "opencode.json");
		const globalConfig = JSON.parse(await getFileContent(globalConfigPath)) as Record<
			string,
			unknown
		>;
		for (const name of configPluginNames(globalConfig)) {
			pluginNames.add(name);
		}
	} catch {
		logger.debug("Global OpenCode config not found or invalid");
	}

	// Read project config (overrides global)
	if (projectDir) {
		try {
			const projectConfigPath = join(projectDir, PROJECT_CONFIG_NAME);
			const projectConfig = JSON.parse(await getFileContent(projectConfigPath)) as Record<
				string,
				unknown
			>;
			for (const name of configPluginNames(projectConfig)) {
				pluginNames.add(name);
			}
		} catch {
			logger.debug("Project OpenCode config not found or invalid");
		}
	}

	// For each plugin name, find it in node_modules
	const npmCacheDir = join(getCacheHome(), "opencode", "node_modules");
	for (const pluginName of pluginNames) {
		try {
			const installPath = join(npmCacheDir, pluginName);
			const pkgJsonPath = join(installPath, "package.json");
			const pkgJson = JSON.parse(await getFileContent(pkgJsonPath)) as Record<string, unknown>;

			const stats = await stat(installPath);
			const version = (pkgJson.version as string) ?? "unknown";
			const key = `${pluginName}@${version}`;

			plugins.push({
				key,
				installPath,
				version,
				lastUpdated: stats.mtime.toISOString(),
			});

			logger.debug(`Discovered NPM plugin: ${key}`, { installPath });
		} catch {
			logger.warn(`NPM plugin listed in config but not found: ${pluginName}`);
		}
	}

	return plugins;
}

/**
 * Discover local plugin files (.js/.ts) in a directory
 */
async function discoverLocalPlugins(
	pluginsDir: string,
	context: string,
	logger: Logger,
): Promise<PluginInfo[]> {
	const plugins: PluginInfo[] = [];

	let entries: string[];
	try {
		entries = await readdir(pluginsDir);
	} catch {
		logger.debug(`${context} plugins directory not found: ${pluginsDir}`);
		return [];
	}

	for (const entry of entries) {
		const fullPath = join(pluginsDir, entry);

		// Only scan .js and .ts files
		if (!(entry.endsWith(".js") || entry.endsWith(".ts"))) {
			continue;
		}

		try {
			const stats = await stat(fullPath);
			if (!stats.isFile()) continue;

			// Use filename as plugin name
			const name = basename(entry, entry.endsWith(".ts") ? ".ts" : ".js");
			const version = `local-${stats.mtime.getTime()}`; // Synthetic version from mtime
			const key = `${context}/${name}@${version}`;

			plugins.push({
				key,
				installPath: fullPath,
				version,
				lastUpdated: stats.mtime.toISOString(),
			});

			logger.debug(`Discovered local plugin: ${key}`, { path: fullPath });
		} catch {
			logger.warn(`Failed to read local plugin: ${entry}`);
		}
	}

	return plugins;
}
