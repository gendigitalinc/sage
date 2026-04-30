import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll } from "vitest";

/**
 * Isolate HOME to a temp directory for the duration of the enclosing describe block.
 * Prevents ~/.sage/config.json (brand_key, sensitivity, etc.) from leaking into tests.
 */
export function useIsolatedHome(prefix: string): { getHome: () => string } {
	let tmpHome = "";
	let origHome: string | undefined;

	beforeAll(async () => {
		origHome = process.env.HOME;
		tmpHome = await mkdtemp(resolve(tmpdir(), `sage-${prefix}-`));
		process.env.HOME = tmpHome;
	});

	afterAll(async () => {
		if (origHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = origHome;
		}
		await rm(tmpHome, { recursive: true, force: true });
	});

	return { getHome: () => tmpHome };
}
