/**
 * Standalone subword tokenizer for the bundled PI model.
 *
 * Implements lowercase + accent-stripping pre-tokenization and a greedy
 * longest-match subword segmentation pass against the model's vocabulary.
 * Only depends on Node.js stdlib (no third-party tokenizer libraries).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Character classification ────────────────────────────────────────

function isWhitespace(ch: string): boolean {
	if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
	// Unicode Zs category (space separators)
	return /^\p{Zs}$/u.test(ch);
}

function isControl(ch: string): boolean {
	if (ch === "\t" || ch === "\n" || ch === "\r") return false;
	return /^\p{Cc}|\p{Cf}$/u.test(ch);
}

function isPunctuation(ch: string): boolean {
	const cp = ch.codePointAt(0) ?? 0;
	if (
		(33 <= cp && cp <= 47) ||
		(58 <= cp && cp <= 64) ||
		(91 <= cp && cp <= 96) ||
		(123 <= cp && cp <= 126)
	) {
		return true;
	}
	return /^\p{P}$/u.test(ch);
}

function isChineseChar(cp: number): boolean {
	return (
		(0x4e00 <= cp && cp <= 0x9fff) ||
		(0x3400 <= cp && cp <= 0x4dbf) ||
		(0x20000 <= cp && cp <= 0x2a6df) ||
		(0x2a700 <= cp && cp <= 0x2b73f) ||
		(0x2b740 <= cp && cp <= 0x2b81f) ||
		(0x2b820 <= cp && cp <= 0x2ceaf) ||
		(0xf900 <= cp && cp <= 0xfaff) ||
		(0x2f800 <= cp && cp <= 0x2fa1f)
	);
}

// ── Pre-tokenization pipeline ───────────────────────────────────────

function cleanText(text: string): { chars: string[]; posMap: number[] } {
	const chars: string[] = [];
	const posMap: number[] = [];
	for (let i = 0; i < text.length; i++) {
		const ch = text[i] ?? "";
		const cp = text.codePointAt(i) ?? 0;
		if (cp === 0 || cp === 0xfffd || isControl(ch)) continue;
		chars.push(isWhitespace(ch) ? " " : ch);
		posMap.push(i);
	}
	return { chars, posMap };
}

function addChineseSpacing(
	chars: string[],
	posMap: number[],
): { chars: string[]; posMap: number[] } {
	const out: string[] = [];
	const newMap: number[] = [];
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i] ?? "";
		const pos = posMap[i] ?? 0;
		if (isChineseChar(ch.codePointAt(0) ?? 0)) {
			out.push(" ", ch, " ");
			newMap.push(pos, pos, pos);
		} else {
			out.push(ch);
			newMap.push(pos);
		}
	}
	return { chars: out, posMap: newMap };
}

function nfcNormalize(chars: string[], posMap: number[]): { chars: string[]; posMap: number[] } {
	const out: string[] = [];
	const newMap: number[] = [];
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i] ?? "";
		const nfc = ch.normalize("NFC");
		for (const c of nfc) {
			out.push(c);
			newMap.push(posMap[i] ?? i);
		}
	}
	return { chars: out, posMap: newMap };
}

function lowercaseChars(chars: string[], posMap: number[]): { chars: string[]; posMap: number[] } {
	return { chars: chars.map((ch) => ch.toLowerCase()), posMap };
}

function stripAccents(chars: string[], posMap: number[]): { chars: string[]; posMap: number[] } {
	const out: string[] = [];
	const newMap: number[] = [];
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i] ?? "";
		const nfd = ch.normalize("NFD");
		for (const c of nfd) {
			// Skip combining marks (Mn category)
			if (!/^\p{Mn}$/u.test(c)) {
				out.push(c);
				newMap.push(posMap[i] ?? i);
			}
		}
	}
	return { chars: out, posMap: newMap };
}

interface WordWithPositions {
	word: string;
	positions: number[];
}

function whitespaceSplit(chars: string[], posMap: number[]): WordWithPositions[] {
	const words: WordWithPositions[] = [];
	let currentChars: string[] = [];
	let currentPos: number[] = [];
	for (let i = 0; i < chars.length; i++) {
		if (chars[i] === " ") {
			if (currentChars.length > 0) {
				words.push({ word: currentChars.join(""), positions: currentPos });
				currentChars = [];
				currentPos = [];
			}
		} else {
			currentChars.push(chars[i] ?? "");
			currentPos.push(posMap[i] ?? i);
		}
	}
	if (currentChars.length > 0) {
		words.push({ word: currentChars.join(""), positions: currentPos });
	}
	return words;
}

function splitOnPunctuation(word: string, positions: number[]): WordWithPositions[] {
	const tokens: WordWithPositions[] = [];
	let currentChars: string[] = [];
	let currentPos: number[] = [];
	for (let i = 0; i < word.length; i++) {
		const ch = word[i] ?? "";
		const pos = positions[i] ?? i;
		if (isPunctuation(ch)) {
			if (currentChars.length > 0) {
				tokens.push({ word: currentChars.join(""), positions: currentPos });
				currentChars = [];
				currentPos = [];
			}
			tokens.push({ word: ch, positions: [pos] });
		} else {
			currentChars.push(ch);
			currentPos.push(pos);
		}
	}
	if (currentChars.length > 0) {
		tokens.push({ word: currentChars.join(""), positions: currentPos });
	}
	return tokens;
}

function pretokenize(text: string): WordWithPositions[] {
	if (!text) return [];

	let { chars, posMap } = cleanText(text);
	({ chars, posMap } = addChineseSpacing(chars, posMap));
	({ chars, posMap } = nfcNormalize(chars, posMap));

	const words = whitespaceSplit(chars, posMap);
	const result: WordWithPositions[] = [];

	for (const { word, positions } of words) {
		let wChars = [...word];
		let wPos = [...positions];

		// Lowercase
		({ chars: wChars, posMap: wPos } = lowercaseChars(wChars, wPos));
		// Strip accents
		({ chars: wChars, posMap: wPos } = stripAccents(wChars, wPos));

		const subTokens = splitOnPunctuation(wChars.join(""), wPos);
		result.push(...subTokens);
	}

	return result;
}

// ── Subword tokenizer ──────────────────────────────────────────────

const MAX_WORD_CHARS = 100;

function tokenizeSubwords(
	word: string,
	vocab: Map<string, number>,
	unkId: number,
): { tokens: string[]; ids: number[]; spans: Array<[number, number]> } {
	if (word.length > MAX_WORD_CHARS) {
		return { tokens: ["[UNK]"], ids: [unkId], spans: [[0, word.length]] };
	}

	const tokens: string[] = [];
	const ids: number[] = [];
	const spans: Array<[number, number]> = [];
	let start = 0;

	while (start < word.length) {
		let end = word.length;
		let found: string | null = null;
		let foundId = -1;

		while (start < end) {
			let substr = word.slice(start, end);
			if (start > 0) substr = `##${substr}`;
			const id = vocab.get(substr);
			if (id !== undefined) {
				found = substr;
				foundId = id;
				break;
			}
			end--;
		}

		if (found === null) {
			return { tokens: ["[UNK]"], ids: [unkId], spans: [[0, word.length]] };
		}

		tokens.push(found);
		ids.push(foundId);
		spans.push([start, end]);
		start = end;
	}

	return { tokens, ids, spans };
}

// ── LocalTokenizer ─────────────────────────────────────────────────

const PAD_ID = 0;
const UNK_ID = 100;
const CLS_ID = 101;
const SEP_ID = 102;

export interface TokenizerOutput {
	input_ids: number[];
	attention_mask: number[];
	token_type_ids: number[];
	offset_mapping?: Array<[number, number]>;
}

export class LocalTokenizer {
	private vocab: Map<string, number>;
	private maxLength: number;

	constructor(vocabPath: string, maxLength = 512) {
		this.maxLength = maxLength;
		this.vocab = this.loadVocab(vocabPath);
	}

	static fromModelDir(modelDir: string, maxLength = 512): LocalTokenizer {
		return new LocalTokenizer(resolve(modelDir, "vocab.txt"), maxLength);
	}

	private loadVocab(path: string): Map<string, number> {
		const vocab = new Map<string, number>();
		const lines = readFileSync(path, "utf-8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			const token = lines[i]?.replace(/\r$/, "");
			if (token) vocab.set(token, i);
		}
		return vocab;
	}

	tokenize(
		text: string,
		options: {
			addSpecialTokens?: boolean;
			returnOffsetMapping?: boolean;
			truncation?: boolean;
			maxLength?: number;
			padding?: boolean;
		} = {},
	): TokenizerOutput {
		const {
			addSpecialTokens = true,
			returnOffsetMapping = false,
			truncation = false,
			maxLength = this.maxLength,
		} = options;

		const preTokens = pretokenize(text);
		const allIds: number[] = [];
		const allOffsets: Array<[number, number]> = [];

		for (const { word, positions } of preTokens) {
			const { ids, spans } = tokenizeSubwords(word, this.vocab, UNK_ID);

			for (let i = 0; i < ids.length; i++) {
				allIds.push(ids[i] ?? UNK_ID);
				const span = spans[i] ?? [0, 0];
				const subPositions = positions.slice(span[0], span[1]);
				if (subPositions.length > 0) {
					const first = subPositions[0] ?? 0;
					const last = subPositions[subPositions.length - 1] ?? 0;
					allOffsets.push([first, last + 1]);
				} else {
					allOffsets.push([positions[0] ?? 0, positions[0] ?? 0]);
				}
			}
		}

		// Truncation
		const contentMax = maxLength - (addSpecialTokens ? 2 : 0);
		if (truncation && allIds.length > contentMax) {
			allIds.length = contentMax;
			allOffsets.length = contentMax;
		}

		// Special tokens
		if (addSpecialTokens) {
			allIds.unshift(CLS_ID);
			allIds.push(SEP_ID);
			allOffsets.unshift([0, 0]);
			allOffsets.push([0, 0]);
		}

		const result: TokenizerOutput = {
			input_ids: allIds,
			attention_mask: new Array(allIds.length).fill(1),
			token_type_ids: new Array(allIds.length).fill(0),
		};

		if (returnOffsetMapping) {
			result.offset_mapping = allOffsets;
		}

		return result;
	}

	/**
	 * Callable interface using snake_case option keys.
	 * Supports: tokenizer(text, { truncation, max_length, padding })
	 */
	call(
		text: string,
		options: {
			add_special_tokens?: boolean;
			return_offsets_mapping?: boolean;
			truncation?: boolean;
			max_length?: number;
			padding?: boolean;
			return_tensor?: boolean;
		} = {},
	): TokenizerOutput {
		const result = this.tokenize(text, {
			addSpecialTokens: options.add_special_tokens ?? true,
			returnOffsetMapping: options.return_offsets_mapping ?? false,
			truncation: options.truncation ?? false,
			maxLength: options.max_length,
			padding: options.padding ?? false,
		});

		// Padding
		if (options.padding && result.input_ids.length < (options.max_length ?? this.maxLength)) {
			const padLen = (options.max_length ?? this.maxLength) - result.input_ids.length;
			result.input_ids.push(...new Array(padLen).fill(PAD_ID));
			result.attention_mask.push(...new Array(padLen).fill(0));
			result.token_type_ids.push(...new Array(padLen).fill(0));
			if (result.offset_mapping) {
				result.offset_mapping.push(...new Array(padLen).fill([0, 0]));
			}
		}

		return result;
	}
}
