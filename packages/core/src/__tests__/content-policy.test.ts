import { describe, expect, it } from "vitest";
import {
	extractWebFetchUrl,
	getUrlExtension,
	isScannableContent,
	SCANNABLE_EXTENSIONS,
} from "../content-policy.js";

describe("SCANNABLE_EXTENSIONS", () => {
	it("includes expected code extensions", () => {
		for (const ext of [".py", ".js", ".ts", ".sh", ".html", ".json", ".yaml", ".c", ".kt"]) {
			expect(SCANNABLE_EXTENSIONS.has(ext)).toBe(true);
		}
	});

	it("excludes non-scannable extensions", () => {
		for (const ext of [".md", ".toml", ".lock", ".pl", ".rb", ".ipynb", ".pdf", ".png"]) {
			expect(SCANNABLE_EXTENSIONS.has(ext)).toBe(false);
		}
	});
});

describe("getUrlExtension", () => {
	it("extracts .py from a raw GitHub URL", () => {
		expect(getUrlExtension("https://raw.githubusercontent.com/org/repo/main/file.py")).toBe(".py");
	});

	it("extracts .html from a URL with query params", () => {
		expect(getUrlExtension("https://example.com/page.html?v=1&lang=en")).toBe(".html");
	});

	it("returns null for extensionless URLs", () => {
		expect(getUrlExtension("https://api.github.com/repos/org/repo")).toBeNull();
	});

	it("returns null for root path", () => {
		expect(getUrlExtension("https://example.com/")).toBeNull();
	});

	it("normalizes to lowercase", () => {
		expect(getUrlExtension("https://example.com/FILE.PY")).toBe(".py");
	});

	it("handles fragment in URL", () => {
		expect(getUrlExtension("https://example.com/page.html#section")).toBe(".html");
	});

	it("returns null for malformed URLs", () => {
		expect(getUrlExtension("not-a-url")).toBeNull();
	});
});

describe("extractWebFetchUrl", () => {
	it("extracts url string", () => {
		expect(extractWebFetchUrl({ url: "https://example.com" })).toBe("https://example.com");
	});

	it("extracts first element from urls array", () => {
		expect(extractWebFetchUrl({ urls: ["https://a.com", "https://b.com"] })).toBe("https://a.com");
	});

	it("returns null for empty input", () => {
		expect(extractWebFetchUrl({})).toBeNull();
	});

	it("returns null for non-string url", () => {
		expect(extractWebFetchUrl({ url: 42 })).toBeNull();
	});

	it("returns null for empty urls array", () => {
		expect(extractWebFetchUrl({ urls: [] })).toBeNull();
	});
});

describe("isScannableContent", () => {
	it("detects HTML doctype", () => {
		expect(isScannableContent("<!DOCTYPE html><html><body>hi</body></html>")).toBe(true);
	});

	it("detects HTML closing tags", () => {
		expect(isScannableContent("some text\n</body>\nmore text")).toBe(true);
	});

	it("detects JSON object", () => {
		expect(isScannableContent('{"key": "value"}')).toBe(true);
	});

	it("detects JSON array", () => {
		expect(isScannableContent('[{"a":1}]')).toBe(true);
	});

	it("detects XML declaration", () => {
		expect(isScannableContent('<?xml version="1.0"?><root/>')).toBe(true);
	});

	it("detects YAML front matter", () => {
		expect(isScannableContent("---\nkey: value\n---")).toBe(true);
	});

	it("detects shell shebang", () => {
		expect(isScannableContent("#!/bin/bash\necho hello")).toBe(true);
	});

	it("detects Python shebang", () => {
		expect(isScannableContent("#!/usr/bin/env python3\nimport sys")).toBe(true);
	});

	it("detects Python imports", () => {
		expect(isScannableContent("import os\nfrom pathlib import Path")).toBe(true);
	});

	it("detects JS/TS patterns", () => {
		expect(isScannableContent('const x = 42;\nconsole.log("hello");')).toBe(true);
	});

	it("detects C/C++ includes", () => {
		expect(isScannableContent("#include <stdio.h>\nint main() {}")).toBe(true);
	});

	it("detects Kotlin patterns", () => {
		expect(isScannableContent("package com.example\nfun main() {}")).toBe(true);
	});

	it("detects CSV", () => {
		expect(isScannableContent("name,age,city\nAlice,30,NYC")).toBe(true);
	});

	it("returns false for plain prose", () => {
		expect(isScannableContent("This is a regular paragraph of text.")).toBe(false);
	});

	it("returns false for markdown", () => {
		expect(isScannableContent("# Title\n\nSome markdown content\n\n- list item")).toBe(false);
	});
});
