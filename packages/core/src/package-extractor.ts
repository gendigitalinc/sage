/**
 * Extract package names from shell commands and manifest file contents.
 * Handles npm, yarn, pnpm, bun, pip, pip3 install patterns.
 */

export interface ParsedPackage {
	name: string;
	registry: "npm" | "pypi";
	version?: string;
	source: "command" | "package.json" | "requirements.txt";
}

/**
 * Extract packages from a shell command string.
 * Handles: npm install/i/add, npx, yarn add, pnpm add/dlx, bun add/bunx, pip/pip3 install.
 */
export function extractPackagesFromCommand(command: string): ParsedPackage[] {
	const packages: ParsedPackage[] = [];

	// Normalize: strip leading env vars, sudo, etc.
	const normalized = command.replace(/^(\s*(sudo|env\s+\S+=\S+)\s+)+/g, "").trim();

	// Split on && or ; to handle chained commands
	const commands = normalized.split(/\s*(?:&&|;|\|)\s*/);

	for (const cmd of commands) {
		const tokens = shellTokenize(cmd.trim());
		if (tokens.length === 0) continue;

		const binary = tokens[0]?.replace(/^.*[/\\]/, "") ?? "";

		if (["npm", "npx"].includes(binary)) {
			packages.push(...extractNpmPackages(tokens));
		} else if (binary === "yarn") {
			packages.push(...extractYarnPackages(tokens));
		} else if (["pnpm", "bunx"].includes(binary)) {
			packages.push(...extractPnpmBunPackages(tokens, binary));
		} else if (binary === "bun") {
			packages.push(...extractBunPackages(tokens));
		} else if (["pip", "pip3"].includes(binary)) {
			packages.push(...extractPipPackages(tokens));
		} else if (
			["python", "python3", "python.exe", "python3.exe"].includes(binary) ||
			binary.match(/python3?\.\d+/) ||
			binary.endsWith("/python") ||
			binary.endsWith("/python3")
		) {
			// Handle: python -m pip install <pkg>
			if (tokens[1] === "-m" && ["pip", "pip3"].includes(tokens[2] ?? "")) {
				packages.push(...extractPipPackages(tokens.slice(2)));
			}
		}
	}

	return packages;
}

/**
 * Extract packages from manifest file content.
 * Supports package.json and requirements.txt.
 */
export function extractPackagesFromManifest(filePath: string, content: string): ParsedPackage[] {
	const lowerPath = filePath.toLowerCase().replace(/\\/g, "/");

	if (lowerPath.endsWith("package.json")) {
		return extractFromPackageJson(content);
	}
	if (lowerPath.endsWith("requirements.txt")) {
		return extractFromRequirementsTxt(content);
	}

	return [];
}

// ── Internal helpers ──────────────────────────────────────────────

/** Simple shell tokenizer — splits on whitespace, respects quotes. */
function shellTokenize(cmd: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let inSingle = false;
	let inDouble = false;

	for (const ch of cmd) {
		if (ch === "'" && !inDouble) {
			inSingle = !inSingle;
		} else if (ch === '"' && !inSingle) {
			inDouble = !inDouble;
		} else if (/\s/.test(ch) && !inSingle && !inDouble) {
			if (current) tokens.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	if (current) tokens.push(current);
	return tokens;
}

/**
 * Check if a version string is a single canonical PEP 440 version
 * (e.g. "1.2.3", "1.2.3.post1", "1.0a2") — not a wildcard, compound
 * specifier, or prefix match pattern.
 */
const PEP440_CANONICAL_RE =
	/^\d+(\.\d+)*([._-]?(a|alpha|b|beta|c|rc|pre|preview|post|rev|dev)\d*)*$/i;
function isPep440Canonical(version: string | undefined): boolean {
	if (!version) return false;
	if (version.includes("*") || version.includes(",")) return false;
	return PEP440_CANONICAL_RE.test(version);
}

/**
 * Return a verifiable version string for a PyPI exact-pin specifier, or
 * undefined if the specifier cannot be verified as a literal release key.
 *
 * - `==`  with a canonical PEP 440 version → version string (normalized
 *         matching with trailing-zero padding in registry client)
 * - `===` with any non-empty token → `"===<token>"` (strict literal
 *         equality — registry client must NOT normalize)
 * - anything else → undefined (skip version verification)
 */
function pypiExactVersion(
	operator: string | undefined,
	version: string | undefined,
): string | undefined {
	if (!operator || !version) return undefined;
	if (operator === "==") return isPep440Canonical(version) ? version : undefined;
	if (operator === "===") return `===${version}`;
	return undefined;
}

/** Check if a token looks like a package name (not a flag, URL, or local path). */
function isPackageName(token: string): boolean {
	if (token.startsWith("-")) return false;
	// Package names must start with a letter or @ (scoped packages)
	if (!/^[a-zA-Z@]/.test(token)) return false;
	if (token.startsWith("https://") || token.startsWith("http://")) return false;
	if (token.startsWith("git+")) return false;
	if (token.startsWith("./") || token.startsWith("../") || token.startsWith("/")) return false;
	if (token.startsWith("file:")) return false;
	if (token === ".") return false;
	return true;
}

/** Split "express@4.18.0" into { name: "express", version: "4.18.0" }. */
function splitNameVersion(token: string): { name: string; version?: string } {
	// Scoped package: @scope/name@version
	if (token.startsWith("@")) {
		const afterScope = token.indexOf("/");
		if (afterScope === -1) return { name: token };
		const rest = token.slice(afterScope + 1);
		const atIdx = rest.indexOf("@");
		if (atIdx > 0) {
			return {
				name: `${token.slice(0, afterScope + 1)}${rest.slice(0, atIdx)}`,
				version: rest.slice(atIdx + 1),
			};
		}
		return { name: token };
	}

	// Regular package: name@version
	const atIdx = token.indexOf("@");
	if (atIdx > 0) {
		return { name: token.slice(0, atIdx), version: token.slice(atIdx + 1) };
	}
	return { name: token };
}

/** Flags that take a value argument (next token is not a package). */
const NPM_VALUE_FLAGS = new Set([
	"--registry",
	"--tag",
	"--workspace",
	"-w",
	"--prefix",
	"--cache",
	"--userconfig",
	"--globalconfig",
]);

function extractNpmPackages(tokens: string[]): ParsedPackage[] {
	const packages: ParsedPackage[] = [];
	const binary = tokens[0]?.replace(/^.*[/\\]/, "") ?? "";

	if (binary === "npx") {
		// npx <pkg> — first non-flag token is the package
		for (let i = 1; i < tokens.length; i++) {
			const t = tokens[i] ?? "";
			if (t === "--" || t === "-y" || t === "--yes" || t === "-p" || t === "--package") continue;
			if (t.startsWith("-")) continue;
			if (!isPackageName(t)) break;
			const { name, version } = splitNameVersion(t);
			packages.push({ name, version, registry: "npm", source: "command" });
			break;
		}
		return packages;
	}

	// npm install/i/add/ci
	const subcommand = tokens[1] ?? "";
	if (!["install", "i", "add", "ci"].includes(subcommand)) return packages;

	let skipNext = false;
	for (let i = 2; i < tokens.length; i++) {
		const t = tokens[i] ?? "";
		if (skipNext) {
			skipNext = false;
			continue;
		}
		if (NPM_VALUE_FLAGS.has(t)) {
			skipNext = true;
			continue;
		}
		if (t.startsWith("-")) continue;
		if (!isPackageName(t)) break;
		const { name, version } = splitNameVersion(t);
		packages.push({ name, version, registry: "npm", source: "command" });
	}
	return packages;
}

function extractYarnPackages(tokens: string[]): ParsedPackage[] {
	const packages: ParsedPackage[] = [];
	const subcommand = tokens[1] ?? "";
	if (subcommand !== "add") return packages;

	for (let i = 2; i < tokens.length; i++) {
		const t = tokens[i] ?? "";
		if (t.startsWith("-")) continue;
		if (!isPackageName(t)) break;
		const { name, version } = splitNameVersion(t);
		packages.push({ name, version, registry: "npm", source: "command" });
	}
	return packages;
}

function extractPnpmBunPackages(tokens: string[], binary: string): ParsedPackage[] {
	const packages: ParsedPackage[] = [];

	if (binary === "bunx") {
		// bunx <pkg> — first non-flag token
		for (let i = 1; i < tokens.length; i++) {
			const t = tokens[i] ?? "";
			if (t.startsWith("-")) continue;
			if (!isPackageName(t)) break;
			const { name, version } = splitNameVersion(t);
			packages.push({ name, version, registry: "npm", source: "command" });
			break;
		}
		return packages;
	}

	// pnpm add/install/dlx
	const subcommand = tokens[1] ?? "";
	if (subcommand === "dlx") {
		// pnpm dlx <pkg> — first non-flag
		for (let i = 2; i < tokens.length; i++) {
			const t = tokens[i] ?? "";
			if (t.startsWith("-")) continue;
			if (!isPackageName(t)) break;
			const { name, version } = splitNameVersion(t);
			packages.push({ name, version, registry: "npm", source: "command" });
			break;
		}
		return packages;
	}

	if (!["add", "install", "i"].includes(subcommand)) return packages;

	for (let i = 2; i < tokens.length; i++) {
		const t = tokens[i] ?? "";
		if (t.startsWith("-")) continue;
		if (!isPackageName(t)) break;
		const { name, version } = splitNameVersion(t);
		packages.push({ name, version, registry: "npm", source: "command" });
	}
	return packages;
}

function extractBunPackages(tokens: string[]): ParsedPackage[] {
	const packages: ParsedPackage[] = [];
	const subcommand = tokens[1] ?? "";

	if (!["add", "install", "i"].includes(subcommand)) return packages;

	for (let i = 2; i < tokens.length; i++) {
		const t = tokens[i] ?? "";
		if (t.startsWith("-")) continue;
		if (!isPackageName(t)) break;
		const { name, version } = splitNameVersion(t);
		packages.push({ name, version, registry: "npm", source: "command" });
	}
	return packages;
}

function extractPipPackages(tokens: string[]): ParsedPackage[] {
	const packages: ParsedPackage[] = [];
	const subcommand = tokens[1] ?? "";
	if (subcommand !== "install") return packages;

	let skipNext = false;
	for (let i = 2; i < tokens.length; i++) {
		const t = tokens[i] ?? "";
		if (skipNext) {
			skipNext = false;
			continue;
		}
		// pip flags that take a value
		if (
			[
				"-r",
				"--requirement",
				"-c",
				"--constraint",
				"-e",
				"--editable",
				"-t",
				"--target",
				"--prefix",
				"-i",
				"--index-url",
				"--extra-index-url",
				"-f",
				"--find-links",
			].includes(t)
		) {
			skipNext = true;
			continue;
		}
		if (t.startsWith("-")) continue;
		if (!isPackageName(t)) break;

		// Extract version for exact pins only:
		// - == with a canonical PEP 440 version (normalized matching in registry)
		// - === with any non-empty token (strict literal equality, no normalization)
		// Prefix matches (==1.2.*), compound specifiers, and range operators are skipped.
		const match = t.match(/^([a-zA-Z0-9._-]+)(?:([><=!~]+)(.+))?$/);
		if (match) {
			packages.push({
				name: match[1] as string,
				version: pypiExactVersion(match[2], match[3]),
				registry: "pypi",
				source: "command",
			});
		}
	}
	return packages;
}

function extractFromPackageJson(content: string): ParsedPackage[] {
	const packages: ParsedPackage[] = [];
	try {
		const data = JSON.parse(content) as Record<string, unknown>;
		const deps = (data.dependencies ?? {}) as Record<string, string>;
		const devDeps = (data.devDependencies ?? {}) as Record<string, string>;

		for (const [name, version] of Object.entries({ ...deps, ...devDeps })) {
			if (typeof version !== "string") continue;
			if (version === "" || version === "*") continue;
			if (
				version.startsWith("file:") ||
				version.startsWith("link:") ||
				version.startsWith("git+") ||
				version.startsWith("git:") ||
				version.startsWith("http:") ||
				version.startsWith("https:") ||
				version.startsWith("workspace:") ||
				version.startsWith("github:") ||
				version.startsWith("bitbucket:") ||
				version.startsWith("gitlab:") ||
				version.startsWith("portal:") ||
				version.startsWith("patch:")
			)
				continue;

			// npm: alias protocol — "npm:real-pkg@^1.0.0" targets a real
			// registry package under a local alias name.
			if (version.startsWith("npm:")) {
				const aliasTarget = version.slice(4);
				const { name: targetName, version: targetVersion } = splitNameVersion(aliasTarget);
				if (targetName) {
					packages.push({
						name: targetName,
						version: targetVersion ?? "",
						registry: "npm",
						source: "package.json",
					});
				}
				continue;
			}

			packages.push({
				name,
				version,
				registry: "npm",
				source: "package.json",
			});
		}
	} catch {
		// Malformed package.json — fail-open
	}
	return packages;
}

function extractFromRequirementsTxt(content: string): ParsedPackage[] {
	const packages: ParsedPackage[] = [];
	const lines = content.split("\n");

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (
			!line ||
			line.startsWith("#") ||
			line.startsWith("-r") ||
			line.startsWith("--requirement") ||
			line.startsWith("-e") ||
			line.startsWith("--editable") ||
			line.startsWith("-i") ||
			line.startsWith("--index-url") ||
			line.startsWith("--extra-index-url") ||
			line.startsWith("-f") ||
			line.startsWith("--find-links") ||
			line.startsWith("-c") ||
			line.startsWith("--constraint")
		) {
			continue;
		}
		// Skip git/URL installs
		if (line.startsWith("git+") || line.startsWith("http://") || line.startsWith("https://")) {
			continue;
		}
		// Strip inline comments and environment markers
		const cleaned = line.split("#")[0]?.split(";")[0]?.trim() ?? "";
		if (!cleaned) continue;

		// Extract version for exact pins only (== canonical or === literal).
		const match = cleaned.match(/^([a-zA-Z0-9._-]+)(?:\[.*\])?(?:([><=!~]+)(.+))?$/);
		if (match) {
			packages.push({
				name: match[1] as string,
				version: pypiExactVersion(match[2], match[3]?.trim()),
				registry: "pypi",
				source: "requirements.txt",
			});
		}
	}
	return packages;
}
