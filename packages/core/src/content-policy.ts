/**
 * Content-type policy for PI pre-fetch scanning.
 * Determines which URLs and content types the ML classifier should process.
 */

// Extensions the PI model is trained on — scan only these.
export const SCANNABLE_EXTENSIONS = new Set([
	".py",
	".js",
	".mjs",
	".cjs",
	".jsx",
	".ts",
	".tsx",
	".mts",
	".cts",
	".sh",
	".bash",
	".html",
	".htm",
	".json",
	".jsonc",
	".txt",
	".csv",
	".xml",
	".c",
	".h",
	".cpp",
	".cc",
	".cxx",
	".hpp",
	".yaml",
	".yml",
	".kt",
	".kts",
]);

export function getUrlExtension(url: string): string | null {
	try {
		const pathname = new URL(url).pathname;
		const dot = pathname.lastIndexOf(".");
		const slash = pathname.lastIndexOf("/");
		if (dot <= slash || dot < 0) return null;
		return pathname.slice(dot).toLowerCase();
	} catch {
		return null;
	}
}

export function extractWebFetchUrl(toolInput: Record<string, unknown>): string | null {
	if (typeof toolInput.url === "string") return toolInput.url;
	if (Array.isArray(toolInput.urls) && typeof toolInput.urls[0] === "string")
		return toolInput.urls[0];
	return null;
}

const SNIFF_HTML = /^\s*<!doctype\s+html|^\s*<html[\s>]/i;
const SNIFF_HTML_TAGS = /<\/(head|body|html|div|p|script|style|form|table)>/i;
const SNIFF_JSON = /^\s*[[{]/;
const SNIFF_XML = /^\s*<\?xml\s/i;
const SNIFF_YAML = /^---\s*$/m;
const SNIFF_SHEBANG_SHELL = /^#!.*\b(sh|bash|zsh|dash)\b/;
const SNIFF_SHEBANG_PYTHON = /^#!.*\bpython/i;
const SNIFF_PYTHON = /^(?:import |from \S+ import |def \w+\(|class \w+[:(])/m;
const SNIFF_JS_TS = /^(?:const |let |var |function |import |export |module\.exports)/m;
const SNIFF_C_CPP = /^#include\s*[<"]/m;
const SNIFF_KOTLIN = /^(?:package |fun |class |val |var |object |interface )\w/m;
const SNIFF_CSV = /^[^,\n]+(?:,[^,\n]+){2,}$/m;

export function isScannableContent(content: string): boolean {
	const head = content.slice(0, 4096);
	return (
		SNIFF_HTML.test(head) ||
		SNIFF_HTML_TAGS.test(head) ||
		SNIFF_JSON.test(head) ||
		SNIFF_XML.test(head) ||
		SNIFF_YAML.test(head) ||
		SNIFF_SHEBANG_SHELL.test(head) ||
		SNIFF_SHEBANG_PYTHON.test(head) ||
		SNIFF_PYTHON.test(head) ||
		SNIFF_JS_TS.test(head) ||
		SNIFF_C_CPP.test(head) ||
		SNIFF_KOTLIN.test(head) ||
		SNIFF_CSV.test(head)
	);
}
