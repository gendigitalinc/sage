import { defaultConfigPath, loadConfig, loadConfigSync, resolvePath } from "./config.js";
import { getFileContent, getFileContentSync } from "./file-utils.js";
import type { Branding, Logger } from "./types.js";
import { ConfigSchema, ExceptionsFileSchema } from "./types.js";

export interface ConfigurationWarning {
	file: "config" | "exceptions";
	path: string;
	reason: "parse" | "validation";
}

function formatPath(path: string): string {
	return path.replace(/\\/g, "/");
}

function configWarning(path: string, reason: ConfigurationWarning["reason"]): ConfigurationWarning {
	return { file: "config", path, reason };
}

function exceptionsWarning(
	path: string,
	reason: ConfigurationWarning["reason"],
): ConfigurationWarning {
	return { file: "exceptions", path, reason };
}

function inspectConfig(raw: string, path: string): ConfigurationWarning | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return configWarning(path, "parse");
	}
	return ConfigSchema.safeParse(data).success ? null : configWarning(path, "validation");
}

function inspectExceptions(raw: string, path: string): ConfigurationWarning | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return exceptionsWarning(path, "parse");
	}
	return ExceptionsFileSchema.safeParse(data).success
		? null
		: exceptionsWarning(path, "validation");
}

export async function getConfigurationWarnings(
	configPath?: string,
	logger?: Logger,
): Promise<ConfigurationWarning[]> {
	const warnings: ConfigurationWarning[] = [];
	const resolvedConfigPath = configPath ? resolvePath(configPath) : defaultConfigPath();

	try {
		const rawConfig = await getFileContent(resolvedConfigPath);
		const warning = inspectConfig(rawConfig, resolvedConfigPath);
		if (warning) warnings.push(warning);
	} catch {
		// Missing config is valid; defaults apply.
	}

	const config = await loadConfig(resolvedConfigPath, logger);
	const exceptionsPath = resolvePath(config.exceptions.path);
	try {
		const rawExceptions = await getFileContent(exceptionsPath);
		const warning = inspectExceptions(rawExceptions, exceptionsPath);
		if (warning) warnings.push(warning);
	} catch {
		// Missing exceptions file is valid; no user rules apply.
	}

	return warnings;
}

export function getConfigurationWarningsSync(
	configPath?: string,
	logger?: Logger,
): ConfigurationWarning[] {
	const warnings: ConfigurationWarning[] = [];
	const resolvedConfigPath = configPath ? resolvePath(configPath) : defaultConfigPath();

	try {
		const rawConfig = getFileContentSync(resolvedConfigPath);
		const warning = inspectConfig(rawConfig, resolvedConfigPath);
		if (warning) warnings.push(warning);
	} catch {
		// Missing config is valid; defaults apply.
	}

	const config = loadConfigSync(resolvedConfigPath, logger);
	const exceptionsPath = resolvePath(config.exceptions.path);
	try {
		const rawExceptions = getFileContentSync(exceptionsPath);
		const warning = inspectExceptions(rawExceptions, exceptionsPath);
		if (warning) warnings.push(warning);
	} catch {
		// Missing exceptions file is valid; no user rules apply.
	}

	return warnings;
}

export function formatConfigurationWarnings(
	warnings: readonly ConfigurationWarning[],
	branding: Branding,
): string | null {
	if (warnings.length === 0) return null;

	const lines = [`⚠️ ${branding.name}: configuration warning`];
	for (const warning of warnings) {
		if (warning.file === "config") {
			const reason = warning.reason === "parse" ? "is not valid JSON" : "has the wrong shape";
			lines.push(
				`- ${formatPath(warning.path)} ${reason}. ${branding.short_name} is using default settings until this file is fixed.`,
			);
		} else if (warning.reason === "parse") {
			lines.push(
				`- ${formatPath(warning.path)} is not valid JSON. Exception rules are not being applied until this file is fixed.`,
			);
		} else {
			lines.push(
				`- ${formatPath(warning.path)} has the wrong shape. Expected ${JSON.stringify({ rules: [] })}. Exception rules are not being applied until this file is fixed.`,
			);
		}
	}
	return lines.join("\n");
}
