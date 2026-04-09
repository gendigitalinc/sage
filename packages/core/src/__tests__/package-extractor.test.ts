import { describe, expect, it } from "vitest";
import { extractPackagesFromCommand, extractPackagesFromManifest } from "../package-extractor.js";

describe("extractPackagesFromCommand", () => {
	it("extracts from npm install", () => {
		const result = extractPackagesFromCommand("npm install express");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("express");
		expect(result[0]?.registry).toBe("npm");
	});

	it("extracts scoped package from npm i", () => {
		const result = extractPackagesFromCommand("npm i @scope/pkg");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("@scope/pkg");
	});

	it("extracts multiple from pip install", () => {
		const result = extractPackagesFromCommand("pip install requests flask");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("requests");
		expect(result[0]?.registry).toBe("pypi");
		expect(result[1]?.name).toBe("flask");
	});

	it("extracts multiple from yarn add", () => {
		const result = extractPackagesFromCommand("yarn add react react-dom");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("react");
		expect(result[1]?.name).toBe("react-dom");
	});

	it("extracts from npx (executable check)", () => {
		const result = extractPackagesFromCommand("npx create-react-app my-app");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("create-react-app");
	});

	it("extracts from pnpm dlx", () => {
		const result = extractPackagesFromCommand("pnpm dlx pkg");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("pkg");
	});

	it("extracts from bunx", () => {
		const result = extractPackagesFromCommand("bunx pkg");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("pkg");
	});

	it("extracts version-pinned package (still checked)", () => {
		const result = extractPackagesFromCommand("npm install express@4.18.0");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("express");
		expect(result[0]?.version).toBe("4.18.0");
	});

	it("skips URL installs", () => {
		const result = extractPackagesFromCommand("pip install https://example.com/pkg.tar.gz");
		expect(result).toHaveLength(0);
	});

	it("skips local path installs", () => {
		const result = extractPackagesFromCommand("npm install ./local-pkg");
		expect(result).toHaveLength(0);
	});

	it("skips git installs", () => {
		const result = extractPackagesFromCommand("pip install git+https://github.com/user/repo.git");
		expect(result).toHaveLength(0);
	});

	it("skips shell redirections like 2>&1", () => {
		const result = extractPackagesFromCommand(
			"python.exe -m pip install python-docx markdown 2>&1 | tail -5",
		);
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("python-docx");
		expect(result[1]?.name).toBe("markdown");
	});

	it("handles npm install with flags", () => {
		const result = extractPackagesFromCommand("npm install -g --save-dev express lodash");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("express");
		expect(result[1]?.name).toBe("lodash");
	});

	it("handles bun add", () => {
		const result = extractPackagesFromCommand("bun add zod");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("zod");
	});

	it("handles pnpm add", () => {
		const result = extractPackagesFromCommand("pnpm add typescript --save-dev");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("typescript");
	});

	it("returns empty for non-install commands", () => {
		const result = extractPackagesFromCommand("npm run build");
		expect(result).toHaveLength(0);
	});

	it("handles chained commands", () => {
		const result = extractPackagesFromCommand("npm install express && npm install lodash");
		expect(result).toHaveLength(2);
	});

	it("extracts from python -m pip install", () => {
		const result = extractPackagesFromCommand("python -m pip install requests");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("requests");
		expect(result[0]?.registry).toBe("pypi");
	});

	it("extracts from python3 -m pip install", () => {
		const result = extractPackagesFromCommand("python3 -m pip install flask gunicorn");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("flask");
		expect(result[1]?.name).toBe("gunicorn");
	});

	it("extracts from full-path python.exe -m pip install", () => {
		const result = extractPackagesFromCommand("/usr/bin/python3 -m pip install numpy");
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("numpy");
	});

	it("extracts version only for == pip specifiers", () => {
		const result = extractPackagesFromCommand("pip install requests==2.31.0 flask>=2.0");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("requests");
		expect(result[0]?.version).toBe("2.31.0");
		expect(result[1]?.name).toBe("flask");
		expect(result[1]?.version).toBeUndefined();
	});

	it("skips version for pip range specifiers (~=, !=, >=)", () => {
		const result = extractPackagesFromCommand("pip install 'django~=4.2' 'celery!=5.0.0'");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("django");
		expect(result[0]?.version).toBeUndefined();
		expect(result[1]?.name).toBe("celery");
		expect(result[1]?.version).toBeUndefined();
	});

	it("preserves === prefix for strict literal equality", () => {
		const result = extractPackagesFromCommand(
			"pip install 'pkg===1.2.3.dev4' 'other===1.0+ubuntu1'",
		);
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("pkg");
		expect(result[0]?.version).toBe("===1.2.3.dev4");
		expect(result[1]?.name).toBe("other");
		expect(result[1]?.version).toBe("===1.0+ubuntu1");
	});

	it("skips version for == with wildcard or compound specifiers", () => {
		const result = extractPackagesFromCommand("pip install 'foo==1.2.*' 'bar==1.2.3,!=1.2.4'");
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("foo");
		expect(result[0]?.version).toBeUndefined();
		expect(result[1]?.name).toBe("bar");
		expect(result[1]?.version).toBeUndefined();
	});
});

describe("extractPackagesFromManifest", () => {
	it("extracts dependencies from package.json", () => {
		const content = JSON.stringify({
			dependencies: { express: "^4.18.0", lodash: "~4.17.0" },
			devDependencies: { typescript: "^5.0.0" },
		});
		const result = extractPackagesFromManifest("package.json", content);
		expect(result).toHaveLength(3);
		expect(result.map((p) => p.name)).toContain("express");
		expect(result.map((p) => p.name)).toContain("typescript");
		expect(result[0]?.registry).toBe("npm");
		expect(result[0]?.source).toBe("package.json");
	});

	it("preserves raw version specifiers from package.json", () => {
		const content = JSON.stringify({
			dependencies: {
				express: "^4.18.0",
				lodash: "~4.17.0",
				typescript: ">=5.0.0 <6.0.0",
				react: "^18.2",
			},
		});
		const result = extractPackagesFromManifest("package.json", content);
		const byName = Object.fromEntries(result.map((p) => [p.name, p.version]));
		expect(byName.express).toBe("^4.18.0");
		expect(byName.lodash).toBe("~4.17.0");
		expect(byName.typescript).toBe(">=5.0.0 <6.0.0");
		expect(byName.react).toBe("^18.2");
	});

	it("skips wildcard and empty versions in package.json", () => {
		const content = JSON.stringify({
			dependencies: { "any-ver": "*", "empty-ver": "" },
		});
		const result = extractPackagesFromManifest("package.json", content);
		expect(result).toHaveLength(0);
	});

	it("skips file: and link: dependencies in package.json", () => {
		const content = JSON.stringify({
			dependencies: { "local-pkg": "file:../local", linked: "link:./linked" },
		});
		const result = extractPackagesFromManifest("package.json", content);
		expect(result).toHaveLength(0);
	});

	it("skips non-registry protocol specifiers in package.json", () => {
		const content = JSON.stringify({
			dependencies: {
				"ws-pkg": "workspace:*",
				"ws-caret": "workspace:^",
				"gh-pkg": "github:user/repo",
				"bb-pkg": "bitbucket:user/repo",
				"gl-pkg": "gitlab:user/repo",
				"portal-pkg": "portal:../other",
				"patch-pkg": "patch:pkg@^1.0.0#./fix.patch",
				"git-pkg": "git:github.com/user/repo.git",
				"http-pkg": "https://example.com/pkg.tgz",
			},
		});
		const result = extractPackagesFromManifest("package.json", content);
		expect(result).toHaveLength(0);
	});

	it("resolves npm: alias to target package for checking", () => {
		const content = JSON.stringify({
			dependencies: {
				"my-alias": "npm:real-pkg@^1.0.0",
				"scoped-alias": "npm:@scope/pkg@~2.3",
				"unversioned-alias": "npm:other-pkg",
			},
		});
		const result = extractPackagesFromManifest("package.json", content);
		expect(result).toHaveLength(3);
		expect(result[0]?.name).toBe("real-pkg");
		expect(result[0]?.version).toBe("^1.0.0");
		expect(result[1]?.name).toBe("@scope/pkg");
		expect(result[1]?.version).toBe("~2.3");
		expect(result[2]?.name).toBe("other-pkg");
	});

	it("extracts from requirements.txt", () => {
		const content =
			"requests==2.31.0\nflask>=2.0\n# comment\n\n-r other.txt\ngit+https://github.com/user/repo.git\n";
		const result = extractPackagesFromManifest("requirements.txt", content);
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("requests");
		expect(result[0]?.registry).toBe("pypi");
		expect(result[0]?.version).toBe("2.31.0");
		expect(result[1]?.name).toBe("flask");
		expect(result[1]?.version).toBeUndefined();
	});

	it("skips version for requirements.txt range specifiers", () => {
		const content = "django~=4.2\nnumpy>=1.24,<2.0\ncelery!=5.0.0\n";
		const result = extractPackagesFromManifest("requirements.txt", content);
		expect(result).toHaveLength(3);
		expect(result[0]?.name).toBe("django");
		expect(result[0]?.version).toBeUndefined();
		expect(result[1]?.name).toBe("numpy");
		expect(result[1]?.version).toBeUndefined();
		expect(result[2]?.name).toBe("celery");
		expect(result[2]?.version).toBeUndefined();
	});

	it("handles malformed package.json gracefully", () => {
		const result = extractPackagesFromManifest("package.json", "not json");
		expect(result).toHaveLength(0);
	});

	it("returns empty for unknown file type", () => {
		const result = extractPackagesFromManifest("Gemfile", "gem 'rails'");
		expect(result).toHaveLength(0);
	});

	it("handles requirements.txt with extras", () => {
		const content = "requests[security]==2.31.0\n";
		const result = extractPackagesFromManifest("requirements.txt", content);
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("requests");
	});
});
