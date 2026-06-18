/**
 * ML-based prompt injection (PI) detection.
 *
 * Loads the bundled PI classifier model per process invocation. Inference
 * runs through an optional native model runtime — if the runtime is missing,
 * the PI check is silently skipped. The local tokenizer has no third-party
 * dependencies.
 *
 * Model outputs two logits (clean, injected) → softmax → P(injected).
 * Long inputs are chunked with a sliding window + overlap to handle content
 * larger than the model's input window.
 *
 * Fail-open: returns null on any error.
 */

import { basename, resolve } from "node:path";
import { getModelDir } from "../model-storage.js";
import type { Logger, PiCheckResult } from "../types.js";
import { DEFAULT_PI_MEDIUM_RISK_THRESHOLD, nullLogger } from "../types.js";
import type { TokenizerOutput } from "./tokenizer.js";

const DEFAULT_MAX_CONTENT_LENGTH = 16_384;
const MAX_TOKENS = 512;
const OVERLAP_TOKENS = 128;
const MODEL_FILE = "model_int8.onnx";
const MODEL_METADATA_FILES = [
	"config.json",
	"special_tokens_map.json",
	"tokenizer.json",
	"tokenizer_config.json",
	"vocab.txt",
	MODEL_FILE,
];

function softmax(logits: number[]): number[] {
	const max = Math.max(...logits);
	const exp = logits.map((x) => Math.exp(x - max));
	const sum = exp.reduce((a, b) => a + b, 0);
	return exp.map((x) => x / sum);
}

function isModelMissingError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;

	const nodeErr = err as NodeJS.ErrnoException;
	if (nodeErr.code === "ENOENT") return true;

	const msg = err.message.toLowerCase();
	return (
		msg.includes("enoent") ||
		msg.includes("no such file or directory") ||
		MODEL_METADATA_FILES.some((name) => msg.includes(name.toLowerCase()))
	);
}

export interface PiCheckProvider {
	checkContent(content: string, context: string): Promise<PiCheckResult | null>;
}

/**
 * Stub provider — returns null (no-op).
 * Used in tests and when the PI check is disabled.
 */
export class StubPiProvider implements PiCheckProvider {
	async checkContent(_content: string, _context: string): Promise<PiCheckResult | null> {
		return null;
	}
}

export interface BundledPiProviderOptions {
	/** Path to directory containing the model and tokenizer files */
	modelPath?: string;
	maxContentLength?: number;
	/**
	 * Minimum risk score that produces a textual finding in the result.
	 * Final deny/ask bucketing is decided by the engine using both the
	 * high and medium thresholds — see DecisionEngine.
	 */
	mediumRiskThreshold?: number;
	logger?: Logger;
}

/**
 * ML classifier for prompt injection detection.
 * Loads model per process (suitable for hook subprocess pattern).
 *
 * Flow:
 *   1. Tokenize content using local files (no download)
 *   2. Chunk with sliding window + overlap to cover long inputs
 *   3. Run inference per chunk → two-class logits → softmax
 *   4. Take max P(injected) across all chunks → risk score
 */
export class BundledPiProvider implements PiCheckProvider {
	/** Tracks whether any instance loaded the model runtime in this process. */
	private static modelRuntimeLoaded = false;

	private readonly modelPath: string;
	private readonly maxContentLength: number;
	private readonly mediumRiskThreshold: number;
	private readonly logger: Logger;

	private tokenizer: {
		call: (text: string, options: Record<string, unknown>) => TokenizerOutput;
		tokenize: (text: string, options: Record<string, unknown>) => TokenizerOutput;
	} | null = null;
	private session: unknown = null;
	private tensorClass: unknown = null;
	private inputNames: Set<string> = new Set();
	private initPromise: Promise<boolean> | null = null;

	/**
	 * Call at the end of the process to prevent native model runtime cleanup
	 * crash (exit code 134/SIGABRT). Only exits if the runtime was actually
	 * loaded.
	 */
	static async exitIfModelLoaded(logger?: Logger): Promise<void> {
		if (!BundledPiProvider.modelRuntimeLoaded) return;
		await logger?.flush?.();
		process.exit(0);
	}

	constructor(options: BundledPiProviderOptions = {}) {
		this.modelPath = options.modelPath ?? getModelDir("pi-model");
		this.maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;
		this.mediumRiskThreshold = options.mediumRiskThreshold ?? DEFAULT_PI_MEDIUM_RISK_THRESHOLD;
		this.logger = options.logger ?? nullLogger;
	}

	async checkContent(content: string, context: string): Promise<PiCheckResult | null> {
		try {
			const truncated = this.truncateContent(content);
			if (truncated.length === 0) return null;

			const loaded = await this.ensureLoaded();
			if (!loaded) return null;

			const chunks = this.chunkText(truncated);
			let maxRisk = 0;
			let maxChunk = "";

			for (const chunk of chunks) {
				if (chunk.length < 10) continue;
				const risk = await this.classifyChunk(chunk);
				if (risk > maxRisk) {
					maxRisk = risk;
					maxChunk = chunk;
				}
			}

			const findings: string[] = [];
			if (maxRisk >= this.mediumRiskThreshold) {
				const snippet = maxChunk.length > 80 ? `${maxChunk.slice(0, 77)}...` : maxChunk;
				findings.push(snippet);
			}

			return {
				risk: maxRisk,
				findings,
				contentName: context,
				modelId: basename(this.modelPath),
				contentSnippet: maxChunk || undefined,
			};
		} catch (err) {
			this.logger.warn("PI check failed (fail-open)", {
				error: err instanceof Error ? err.message : String(err),
				context,
			});
			return null;
		}
	}

	private async ensureLoaded(): Promise<boolean> {
		if (this.session && this.tokenizer) return true;
		if (this.initPromise) return this.initPromise;
		this.initPromise = this.loadModel();
		return this.initPromise;
	}

	private async loadModel(): Promise<boolean> {
		try {
			const { LocalTokenizer } = await import("./tokenizer.js");
			this.tokenizer = LocalTokenizer.fromModelDir(this.modelPath, MAX_TOKENS);

			const { ensurePiDeps } = await import("./pi-deps-installer.js");
			const depsReady = await ensurePiDeps(this.modelPath, this.logger);
			if (!depsReady) return false;

			const { createRequire } = await import("node:module");
			const requireFromModel = createRequire(resolve(this.modelPath, "package.json"));
			const runtime = requireFromModel("onnxruntime-node");

			this.tensorClass = runtime.Tensor;
			const modelFilePath = resolve(this.modelPath, MODEL_FILE);
			this.session = await runtime.InferenceSession.create(modelFilePath);

			const sess = this.session as { inputNames: string[] };
			this.inputNames = new Set(sess.inputNames);

			BundledPiProvider.modelRuntimeLoaded = true;
			this.logger.info("PI model loaded", { path: this.modelPath });
			return true;
		} catch (err) {
			if (isModelMissingError(err)) {
				this.logger.debug("PI model not yet available; using heuristics only", {
					path: this.modelPath,
					error: err instanceof Error ? err.message : String(err),
				});
				return false;
			}

			const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
			this.logger.warn(
				`PI model load failed (pi_check is enabled but inference will be skipped): ${errMsg}`,
			);
			return false;
		}
	}

	/**
	 * Classify a single chunk. Returns P(injected) via softmax over two-class logits.
	 */
	private async classifyChunk(text: string): Promise<number> {
		const tok = this.tokenizer;
		if (!tok) throw new Error("PI tokenizer is not loaded");

		const encoded = tok.call(text, {
			truncation: true,
			max_length: MAX_TOKENS,
			padding: true,
		});

		const inputIds = new BigInt64Array(encoded.input_ids.map((v) => BigInt(v)));
		const attentionMask = new BigInt64Array(encoded.attention_mask.map((v) => BigInt(v)));

		const TensorClass = this.tensorClass as new (
			type: string,
			data: BigInt64Array,
			dims: number[],
		) => unknown;

		const feeds: Record<string, unknown> = {
			input_ids: new TensorClass("int64", inputIds, [1, inputIds.length]),
			attention_mask: new TensorClass("int64", attentionMask, [1, attentionMask.length]),
		};

		if (this.inputNames.has("token_type_ids")) {
			feeds.token_type_ids = new TensorClass("int64", new BigInt64Array(inputIds.length), [
				1,
				inputIds.length,
			]);
		}

		const session = this.session as {
			run(feeds: Record<string, unknown>): Promise<{ logits: { data: Float32Array } }>;
		};

		const output = await session.run(feeds);
		const logits = Array.from(output.logits?.data ?? []);
		if (logits.length < 2) return 0;

		// Two-class softmax: [P(clean), P(injected)]
		const probs = softmax(logits);
		return probs[1] ?? 0;
	}

	/**
	 * Chunk text with a sliding window over tokenized input. Window size and
	 * overlap are tuned to the model's input window.
	 */
	private chunkText(text: string): string[] {
		const tok = this.tokenizer;
		if (!tok) throw new Error("PI tokenizer is not loaded");

		const encoded = tok.tokenize(text, {
			addSpecialTokens: false,
			returnOffsetMapping: true,
			truncation: false,
		});

		const tokenIds = encoded.input_ids;
		const offsets = encoded.offset_mapping;
		if (!offsets) return [text];

		if (tokenIds.length <= MAX_TOKENS) return [text];

		const chunks: string[] = [];
		let start = 0;

		while (start < tokenIds.length) {
			const end = Math.min(start + MAX_TOKENS, tokenIds.length);
			const charStart = offsets[start]?.[0] ?? 0;
			const charEnd = offsets[end - 1]?.[1] ?? text.length;
			chunks.push(text.slice(charStart, charEnd));
			if (end >= tokenIds.length) break;
			start = end - OVERLAP_TOKENS;
		}

		return chunks;
	}

	private truncateContent(content: string): string {
		if (content.length <= this.maxContentLength) return content;
		const headLen = Math.floor(this.maxContentLength * 0.8);
		const tailLen = this.maxContentLength - headLen;
		return `${content.slice(0, headLen)}\n...[truncated]...\n${content.slice(-tailLen)}`;
	}
}
