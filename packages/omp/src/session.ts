/**
 * Session start for Oh My Pi.
 *
 * OMP emits `session_start` while loading hooks, before this factory can
 * subscribe, so the scan runs on `agent_start` (the first event both hosts
 * deliver after registration). It calls `runPluginScan`, which is
 * `runSessionStart`: version check (heartbeat), config defaults, plugin/skill
 * scan, and the detached model-download / skill-upload workers.
 *
 * Without this, omp users never appear in heartbeats and the PI model is
 * never downloaded.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
	type Branding,
	discoverLooseSkillsAcrossRoots,
	type Logger,
	type PluginInfo,
	type SkillRoot,
} from "@gendigital/sage-core";
import { runHookSessionScan } from "@gendigital/sage-hook-host";

export interface OmpSessionInput {
	logger: Logger;
	branding: Branding;
	cwd: string;
	agentRuntimeVersion?: string;
	threatsDir: string;
	trustedDomainsDir: string;
	version: string;
	modelDownloadWorkerPath: string;
	skillUploadWorkerPath: string;
}

/**
 * OMP skill roots. Personal skills live under `~/.omp/agent/skills`; OMP reads
 * pi's `PI_CODING_AGENT_DIR` for that directory (`omp --help`), so an override
 * has to be honored or skill discovery misses the relocated folder.
 */
export function resolveOmpSkillRoots(cwd: string): SkillRoot[] {
	const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".omp", "agent");
	return [
		{ dir: join(agentDir, "skills"), tag: "omp", scope: "personal" },
		{ dir: join(homedir(), ".agents", "skills"), tag: "agents", scope: "personal" },
		{ dir: join(cwd, ".omp", "skills"), tag: "omp", scope: "project" },
	];
}

/** Runs the scan; returns user-facing messages (empty when nothing to say). */
export async function runOmpSessionScan(input: OmpSessionInput): Promise<string[]> {
	const plugins: PluginInfo[] = await discoverLooseSkillsAcrossRoots(
		resolveOmpSkillRoots(input.cwd),
	);
	return runHookSessionScan({ ...input, agentRuntime: "omp", plugins });
}
