/**
 * Model manifest fetch — POSTs the standard Sage envelope (plus the local
 * model-schema tag) to the Sage proxy and returns the per-model archive
 * URLs and SHA-256 checksums to install.
 *
 * Mirrors `version-check.ts`: same envelope, same 5 s timeout, fail-open
 * (returns null on any error).
 */

import { buildSageProxyEnvelope, type SageProxyEnvelope } from "../sage-proxy.js";
import type { AgentRuntime, Logger } from "../types.js";
import { nullLogger } from "../types.js";
import { VERSION } from "../version.js";
import { resolveEndpoint } from "./url-check.js";

const DEFAULT_TIMEOUT_MS = 5_000;

/** One model entry in the manifest response. */
export interface ModelManifestEntry {
	url: string;
	sha256: string;
}

/** Parsed response from `/v2/model-manifest`. */
export interface ModelManifest {
	schema: string;
	models: Record<string, ModelManifestEntry>;
}

/** Request body — the standard envelope plus the requested model schema tag. */
export type ManifestRequestBody = SageProxyEnvelope & { models: { schema: string } };

export interface FetchModelManifestArgs {
	iid: string;
	schema: string;
	agentRuntime: AgentRuntime | string;
	agentRuntimeVersion?: string;
	versionApp?: string;
	logger?: Logger;
	timeoutMs?: number;
}

/**
 * Fetch the per-model archive URLs and checksums for the requested schema.
 * Returns null on any failure (network, parse, schema mismatch, malformed entries).
 */
export async function fetchModelManifest(
	args: FetchModelManifestArgs,
): Promise<ModelManifest | null> {
	const logger = args.logger ?? nullLogger;
	const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	if (!args.iid) {
		logger.debug("Skipping model manifest fetch: missing installation id");
		return null;
	}

	const envelope = buildSageProxyEnvelope({
		iid: args.iid,
		versionApp: args.versionApp ?? VERSION,
		agentRuntime: args.agentRuntime,
		agentRuntimeVersion: args.agentRuntimeVersion ?? "unknown",
	});
	const body: ManifestRequestBody = { ...envelope, models: { schema: args.schema } };

	try {
		const response = await fetch(resolveEndpoint("/v2/model-manifest"), {
			method: "POST",
			signal: AbortSignal.timeout(timeoutMs),
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			logger.debug(`Model manifest HTTP ${response.status}`);
			return null;
		}

		const parsed = (await response.json()) as Record<string, unknown>;
		const schema = parsed.schema;
		if (typeof schema !== "string" || schema !== args.schema) {
			logger.debug("Model manifest: schema mismatch or missing", {
				requested: args.schema,
				received: typeof schema === "string" ? schema : null,
			});
			return null;
		}

		const rawModels = parsed.models;
		if (!rawModels || typeof rawModels !== "object" || Array.isArray(rawModels)) {
			logger.debug("Model manifest: missing or malformed `models` field");
			return null;
		}

		const models: Record<string, ModelManifestEntry> = {};
		for (const [name, raw] of Object.entries(rawModels as Record<string, unknown>)) {
			if (!raw || typeof raw !== "object") continue;
			const entry = raw as Record<string, unknown>;
			const url = entry.url;
			const sha256 = entry.sha256;
			if (typeof url !== "string" || url.length === 0) {
				logger.warn(`Model manifest entry '${name}' missing url; skipping`);
				continue;
			}
			if (typeof sha256 !== "string" || sha256.length === 0) {
				// §3.4: sha256 is mandatory. Reject the entry but keep the rest.
				logger.warn(`Model manifest entry '${name}' missing sha256; skipping`);
				continue;
			}
			models[name] = { url, sha256 };
		}

		return { schema, models };
	} catch (err) {
		logger.debug(`Model manifest fetch failed: ${err}`);
		return null;
	}
}
