/**
 * HTTP client for pre-fetching URL content for PI (prompt-injection) scanning.
 * Uses native fetch — no external HTTP dependencies.
 */

import type { Logger } from "../types.js";
import { nullLogger } from "../types.js";

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_MAX_CONTENT_LENGTH = 16_384;
const BINARY_SNIFF_LENGTH = 512;

const TEXTUAL_APPLICATION_TYPES = new Set([
	"application/json",
	"application/xml",
	"application/xhtml+xml",
	"application/javascript",
	"application/x-yaml",
	"application/yaml",
	"application/rss+xml",
	"application/atom+xml",
	"application/ld+json",
]);

export interface FetchedContent {
	content: string;
	contentType: string | null;
}

export class ContentFetchClient {
	private readonly timeoutMs: number;
	private readonly maxContentLength: number;
	private readonly logger: Logger;

	constructor(
		timeoutMs: number = DEFAULT_TIMEOUT_MS,
		maxContentLength: number = DEFAULT_MAX_CONTENT_LENGTH,
		logger: Logger = nullLogger,
	) {
		this.timeoutMs = timeoutMs;
		this.maxContentLength = maxContentLength;
		this.logger = logger;
	}

	async fetchTextContent(url: string): Promise<FetchedContent | null> {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(this.timeoutMs),
				redirect: "follow",
				headers: { "User-Agent": "sage" },
			});

			if (!response.ok) {
				this.logger.debug("Content fetch failed", { url, status: String(response.status) });
				return null;
			}

			const contentType = response.headers.get("content-type");
			if (!ContentFetchClient.isTextualContentType(contentType)) {
				this.logger.debug("Skipping non-textual content type", {
					url,
					contentType: contentType ?? "unknown",
				});
				return null;
			}

			const reader = response.body?.getReader();
			if (!reader) return null;

			const decoder = new TextDecoder();
			let text = "";
			try {
				while (text.length < this.maxContentLength) {
					const { done, value } = await reader.read();
					if (done) break;
					text += decoder.decode(value, { stream: true });
				}
				text += decoder.decode();
			} finally {
				reader.cancel();
			}

			if (text.length > this.maxContentLength) {
				text = text.slice(0, this.maxContentLength);
			}

			if (ContentFetchClient.hasBinaryContent(text)) {
				this.logger.debug("Skipping binary content", { url });
				return null;
			}

			return { content: text, contentType };
		} catch (error) {
			this.logger.debug("Content fetch error", { url, error: String(error) });
			return null;
		}
	}

	static isTextualContentType(contentType: string | null): boolean {
		if (contentType == null) return true;

		const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
		if (mime.startsWith("text/")) return true;
		return TEXTUAL_APPLICATION_TYPES.has(mime);
	}

	static hasBinaryContent(text: string): boolean {
		const sniff = text.slice(0, BINARY_SNIFF_LENGTH);
		return sniff.includes("\0");
	}
}
