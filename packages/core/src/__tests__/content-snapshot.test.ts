import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
	buildContentSnapshot,
	CONTENT_FIELD_LIMITS,
	resolveFilePath,
	safeTruncate,
	scrubHomePath,
} from "../content-snapshot.js";
import type { Artifact, AuditSignals } from "../types.js";

describe("safeTruncate", () => {
	it("returns input unchanged when below limit", () => {
		expect(safeTruncate("hello", 10)).toBe("hello");
	});

	it("returns input unchanged when exactly at limit", () => {
		expect(safeTruncate("12345", 5)).toBe("12345");
	});

	it("truncates to maxLen for ASCII content", () => {
		expect(safeTruncate("0123456789", 4)).toBe("0123");
	});

	it("returns empty string for non-positive maxLen", () => {
		expect(safeTruncate("hello", 0)).toBe("");
		expect(safeTruncate("hello", -1)).toBe("");
	});

	it("does not split a surrogate pair (drops trailing high surrogate)", () => {
		// "𝕏" (U+1D54F) is a non-BMP code point encoded as a surrogate pair (2 UTF-16 units).
		// Cutting at 1 code unit would leave a lone high surrogate; safeTruncate must drop it.
		const value = `a𝕏b`;
		expect(value.length).toBe(4); // 1 + 2 (surrogate pair) + 1
		// maxLen=2 would normally land between the high and low surrogate. Expect just "a".
		expect(safeTruncate(value, 2)).toBe("a");
		// maxLen=3 keeps the full surrogate pair.
		expect(safeTruncate(value, 3)).toBe(`a𝕏`);
	});

	it("preserves a complete BMP character at the boundary", () => {
		// Latin-1 Supplement chars are single UTF-16 units — no surrogate handling needed.
		expect(safeTruncate("café", 3)).toBe("caf");
	});
});

describe("scrubHomePath", () => {
	const home = homedir();

	it("returns the input unchanged when it does not start with home", () => {
		expect(scrubHomePath("/var/log/syslog")).toBe("/var/log/syslog");
	});

	it("replaces home directory prefix with ~", () => {
		const path = `${home}/projects/sage/file.ts`;
		const expected = `~/projects/sage/file.ts`;
		expect(scrubHomePath(path).replace(/\\/g, "/")).toBe(expected);
	});

	it("returns ~ when the input equals the home directory exactly", () => {
		expect(scrubHomePath(home)).toBe("~");
	});

	it("normalizes Windows-style home prefix even when separators differ", () => {
		// Simulate a value that uses forward slashes but home uses backslashes (Windows).
		const value = `${home.replace(/\\/g, "/")}/inner/file.ts`;
		const result = scrubHomePath(value);
		expect(result.startsWith("~/inner")).toBe(true);
	});

	it("does not replace later occurrences of the home string mid-value", () => {
		// Only the leading prefix gets replaced — embedded occurrences are preserved
		// to avoid corrupting JSON blobs and free-form text.
		const value = `/tmp/report-${home.replace(/[\\/]/g, "_")}/log`;
		// The encoded form will not start with `home`, so the value should be returned as-is.
		expect(scrubHomePath(value)).toBe(value);
	});
});

describe("buildContentSnapshot", () => {
	const home = homedir();

	it("resolveFilePath accepts shared file path field variants", () => {
		expect(resolveFilePath({ file_path: "/a", filePath: "/b", path: "/c" })).toBe("/a");
		expect(resolveFilePath({ filePath: "/b", path: "/c" })).toBe("/b");
		expect(resolveFilePath({ path: "/c" })).toBe("/c");
		expect(resolveFilePath({ file_path: "", filePath: "/b" })).toBe("/b");
	});

	describe("tool-type extraction", () => {
		it("Bash extracts command", () => {
			const snap = buildContentSnapshot("Bash", { command: "ls -la" });
			expect(snap).toEqual({ command: "ls -la" });
		});

		it("Bash with non-string command emits empty content", () => {
			const snap = buildContentSnapshot("Bash", { command: 42 });
			expect(snap).toEqual({});
		});

		it("WebFetch extracts url from { url }", () => {
			const snap = buildContentSnapshot("WebFetch", { url: "https://example.com/foo" });
			expect(snap).toEqual({ url: "https://example.com/foo" });
		});

		it("WebFetch extracts first url from { urls: [] } (VS Code shape)", () => {
			const snap = buildContentSnapshot("WebFetch", {
				urls: ["https://a.example.com", "https://b.example.com"],
			});
			expect(snap).toEqual({ url: "https://a.example.com" });
		});

		it("WebFetch falls back to first url artifact when toolInput has none", () => {
			const artifacts: Artifact[] = [
				{ type: "command", value: "fetch foo" },
				{ type: "url", value: "https://artifact.example.com/x" },
				{ type: "url", value: "https://artifact.example.com/y" },
			];
			const snap = buildContentSnapshot("WebFetch", {}, artifacts);
			expect(snap).toEqual({ url: "https://artifact.example.com/x" });
		});

		it.each([
			["Write", "/tmp/foo.ts"],
			["Edit", "/tmp/bar.ts"],
			["Read", "/tmp/baz.ts"],
			["Delete", "/tmp/qux.ts"],
		] as const)("%s extracts file_path from snake_case", (tool, path) => {
			const snap = buildContentSnapshot(tool, { file_path: path });
			expect(snap).toEqual({ file_path: path });
		});

		it("Write resolves filePath (camelCase) and path variants", () => {
			expect(buildContentSnapshot("Write", { filePath: "/a" })).toEqual({ file_path: "/a" });
			expect(buildContentSnapshot("Write", { path: "/b" })).toEqual({ file_path: "/b" });
		});

		it("Write prefers file_path over filePath over path", () => {
			const snap = buildContentSnapshot("Write", {
				file_path: "/a",
				filePath: "/b",
				path: "/c",
			});
			expect(snap).toEqual({ file_path: "/a" });
		});

		it("ApplyPatch extracts the first file from `*** Add File:` header (input field)", () => {
			const patch = `*** Begin Patch
*** Add File: src/foo.ts
+ // contents
*** End Patch`;
			const snap = buildContentSnapshot("ApplyPatch", { input: patch });
			expect(snap).toEqual({ file_path: "src/foo.ts" });
		});

		it("ApplyPatch reads `patch` field as alternative to `input` (Copilot CLI shape)", () => {
			const patch = `*** Update File: lib/bar.ts
@@ context @@
-old
+new`;
			const snap = buildContentSnapshot("ApplyPatch", { patch });
			expect(snap).toEqual({ file_path: "lib/bar.ts" });
		});

		it("ApplyPatch with rename header captures source path", () => {
			const patch = `*** Move to: dest/new-name.ts -> src/old-name.ts`;
			const snap = buildContentSnapshot("ApplyPatch", { input: patch });
			// First match in the regex pattern lookup; "Move to" form keeps the leading
			// (source) path so the snapshot reflects the file the user references first.
			expect(snap.file_path).toBe("dest/new-name.ts");
		});

		it("ApplyPatch with empty / missing patch produces no content", () => {
			expect(buildContentSnapshot("ApplyPatch", {})).toEqual({});
			expect(buildContentSnapshot("ApplyPatch", { input: "" })).toEqual({});
		});

		it("MCP extracts canonical fields from nested tool_input", () => {
			const snap = buildContentSnapshot("MCP", {
				server_name: "shell-mcp",
				tool_input: { command: "rm -rf /tmp/foo" },
			});
			expect(snap).toEqual({ command: "rm -rf /tmp/foo" });
		});

		it("MCP also accepts toolInput (camelCase) nesting", () => {
			const snap = buildContentSnapshot("MCP", {
				toolInput: { url: "https://mcp-target.example.com" },
			});
			expect(snap).toEqual({ url: "https://mcp-target.example.com" });
		});

		it("MCP falls back to top-level fields when no nested toolInput is present", () => {
			const snap = buildContentSnapshot("MCP", { file_path: "/tmp/mcp.txt" });
			expect(snap).toEqual({ file_path: "/tmp/mcp.txt" });
		});

		it("MCP drops residual nested keys without a canonical mapping (no catch-all)", () => {
			const snap = buildContentSnapshot("MCP", {
				tool_input: {
					command: "echo hi",
					random_field: "should not leak",
					another_unknown: { nested: "blob" },
				},
			});
			expect(snap).toEqual({ command: "echo hi" });
		});

		it.each([
			"Glob",
			"Grep",
			"List",
			"CodeSearch",
			"WebSearch",
			"Question",
			"Task",
			"ReadLines",
			"Unknown",
		] as const)("%s emits empty content (no FP-relevant snapshot)", (tool) => {
			expect(buildContentSnapshot(tool, { whatever: "x" })).toEqual({});
		});
	});

	describe("signal-driven multi-value selection", () => {
		it("uses first url_check signal when toolInput did not provide a url", () => {
			const signals: AuditSignals = {
				url_checks: [
					{ detection_name: "Phishing:A", url: "https://bad-a.example.com" },
					{ detection_name: "Phishing:B", url: "https://bad-b.example.com" },
				],
			};
			const snap = buildContentSnapshot("Bash", { command: "curl bad-a.example.com" }, [], signals);
			expect(snap.command).toBe("curl bad-a.example.com");
			expect(snap.url).toBe("https://bad-a.example.com");
		});

		it("does not overwrite a url already set by toolInput extraction", () => {
			const signals: AuditSignals = {
				url_checks: [{ detection_name: "Phishing:Sig", url: "https://from-signals.example.com" }],
			};
			const snap = buildContentSnapshot(
				"WebFetch",
				{ url: "https://from-toolinput.example.com" },
				[],
				signals,
			);
			expect(snap.url).toBe("https://from-toolinput.example.com");
		});

		it("populates first package_check fields into content for multi-package denies", () => {
			const signals: AuditSignals = {
				package_checks: [
					{
						detection_name: "PKG|malicious|...",
						package_name: "evil-a",
						package_version: "1.0.0",
						package_registry: "npm",
					},
					{
						detection_name: "PKG|malicious|...",
						package_name: "evil-b",
						package_version: "2.0.0",
						package_registry: "npm",
					},
				],
			};
			const snap = buildContentSnapshot("Write", { file_path: "/tmp/package.json" }, [], signals);
			expect(snap).toEqual({
				file_path: "/tmp/package.json",
				package_name: "evil-a",
				package_version: "1.0.0",
				package_registry: "npm",
			});
		});

		it("omits package_version / package_registry when first package signal lacks them", () => {
			const signals: AuditSignals = {
				package_checks: [
					{
						detection_name: "PKG|...",
						package_name: "lone",
						package_registry: "npm",
					},
				],
			};
			const snap = buildContentSnapshot("Bash", { command: "npm i lone" }, [], signals);
			expect(snap.package_name).toBe("lone");
			expect(snap.package_registry).toBe("npm");
			expect(snap).not.toHaveProperty("package_version");
		});
	});

	describe("redaction and per-field caps", () => {
		it("scrubs home directory from file_path", () => {
			const snap = buildContentSnapshot("Write", { file_path: `${home}/projects/secret/foo.ts` });
			expect((snap.file_path as string).replace(/\\/g, "/")).toBe("~/projects/secret/foo.ts");
		});

		it("scrubs home directory from command (leading prefix only)", () => {
			const snap = buildContentSnapshot("Bash", { command: `${home}/scripts/run.sh --flag` });
			expect((snap.command as string).replace(/\\/g, "/")).toBe("~/scripts/run.sh --flag");
		});

		it("does not scrub url field (URLs are not paths)", () => {
			const url = `https://example.com/some/path`;
			const snap = buildContentSnapshot("WebFetch", { url });
			expect(snap.url).toBe(url);
		});

		it("caps command at CONTENT_FIELD_LIMITS.command", () => {
			const command = "x".repeat(CONTENT_FIELD_LIMITS.command + 500);
			const snap = buildContentSnapshot("Bash", { command });
			expect((snap.command as string).length).toBe(CONTENT_FIELD_LIMITS.command);
		});

		it("caps url at CONTENT_FIELD_LIMITS.url", () => {
			const url = `https://example.com/${"a".repeat(CONTENT_FIELD_LIMITS.url + 500)}`;
			const snap = buildContentSnapshot("WebFetch", { url });
			expect((snap.url as string).length).toBe(CONTENT_FIELD_LIMITS.url);
		});

		it("caps file_path at CONTENT_FIELD_LIMITS.file_path", () => {
			const filePath = `/tmp/${"a".repeat(CONTENT_FIELD_LIMITS.file_path + 500)}`;
			const snap = buildContentSnapshot("Write", { file_path: filePath });
			expect((snap.file_path as string).length).toBe(CONTENT_FIELD_LIMITS.file_path);
		});

		it("caps package_name at CONTENT_FIELD_LIMITS.package_name", () => {
			const giant = "p".repeat(CONTENT_FIELD_LIMITS.package_name + 200);
			const signals: AuditSignals = {
				package_checks: [{ detection_name: "PKG", package_name: giant, package_registry: "npm" }],
			};
			const snap = buildContentSnapshot("Bash", { command: "x" }, [], signals);
			expect((snap.package_name as string).length).toBe(CONTENT_FIELD_LIMITS.package_name);
		});

		it("uses safeTruncate (does not split surrogate pairs at the cap boundary)", () => {
			// Build a command whose Nth char is the high surrogate of a non-BMP code point;
			// the cap must drop that high surrogate rather than emit a lone half-pair.
			const filler = "a".repeat(CONTENT_FIELD_LIMITS.command - 1);
			const command = `${filler}𝕏tail`;
			const snap = buildContentSnapshot("Bash", { command });
			const result = snap.command as string;
			// Length is at most the cap; the high surrogate at position cap-1 was dropped, so
			// we get filler.length characters and no orphan code unit.
			expect(result.length).toBe(CONTENT_FIELD_LIMITS.command - 1);
			// Last char is plain "a", not a half-surrogate.
			expect(result.charCodeAt(result.length - 1)).toBe("a".charCodeAt(0));
		});
	});

	describe("MCP-derived field caps", () => {
		it("applies the same per-field caps to MCP-derived url", () => {
			const url = `https://example.com/${"q".repeat(CONTENT_FIELD_LIMITS.url + 500)}`;
			const snap = buildContentSnapshot("MCP", { tool_input: { url } });
			expect((snap.url as string).length).toBe(CONTENT_FIELD_LIMITS.url);
		});
	});
});
