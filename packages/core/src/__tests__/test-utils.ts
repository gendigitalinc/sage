import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeTmpDir(): Promise<string> {
	const dir = join(tmpdir(), `sage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	await mkdir(dir, { recursive: true });
	return dir;
}

export type RestoreEnv = { restore: () => void };

/**
 * Snapshot the listed env vars and return a `restore()` callback that puts
 * them back exactly as they were — including deleting vars that were unset
 * at snapshot time. Use in `afterEach` (or stash on the suite and call from
 * a `try/finally`) to make env mutation in tests reversible without leaking
 * state to the next test.
 */
export function snapshotEnv(keys: readonly string[]): RestoreEnv {
	const before: Record<string, string | undefined> = {};
	for (const k of keys) before[k] = process.env[k];
	return {
		restore: () => {
			for (const k of keys) {
				const v = before[k];
				if (v === undefined) delete process.env[k];
				else process.env[k] = v;
			}
		},
	};
}

/**
 * Override the OS home directory for the duration of a test. Sets BOTH
 * `HOME` (POSIX, what `os.homedir()` reads on Linux/macOS) AND `USERPROFILE`
 * (what `os.homedir()` reads on Windows), so the same call works on every
 * platform we run CI on. The returned `restore()` puts both vars back.
 *
 * Use whenever code under test calls `os.homedir()` — the file loader for
 * `~/.sage/extended-info.json`, `normalizeStateFilePath`, the audit-log
 * default path, etc. Take the snapshot inside the test (not at module
 * scope) so each test gets an independent baseline regardless of what
 * preceding tests did.
 *
 * Cross-package note: if a second package needs this helper, copy it once
 * into that package's own `test-utils.ts`. Three or more consumers is the
 * trigger to extract a shared `@gendigital/sage-test-utils` package.
 */
export function withHomeOverride(dir: string): RestoreEnv {
	const snap = snapshotEnv(["HOME", "USERPROFILE"]);
	process.env.HOME = dir;
	process.env.USERPROFILE = dir;
	return snap;
}
