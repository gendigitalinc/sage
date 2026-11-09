/**
 * Bounded text deobfuscation for prompt-injection content scanning.
 *
 * Produces *variants* of a text in which common obfuscation has been undone, so
 * the existing prompt-injection rules can match instructions that were hidden
 * from a plain-text scan. Variants are only ever scanned as text — nothing here
 * evaluates, executes or fetches anything — and the original text is never
 * replaced: callers scan the raw text and the variants.
 *
 * Every transform is conservative on purpose. Variants are matched only by the
 * prompt-injection rules, so a variant can only matter if its text matches one,
 * and each transform refuses to touch content that is plausibly legitimate
 * (versions, hashes, sizes, short number lists, anything that does not decode to
 * readable text). Snippets decoded from one text are joined with newlines into a
 * single variant, so a rule could in principle match across two unrelated
 * snippets; that is accepted because each snippet must itself read as text.
 */

import { MAX_CONTENT_SIZE } from "./extractors.js";

export type DeobfuscationTechnique = "unicode" | "spaced" | "leet" | "base64" | "hex";

export interface DeobfuscatedVariant {
	text: string;
	/** Transforms applied (in order) to the original text to produce this variant. */
	techniques: DeobfuscationTechnique[];
}

export interface DeobfuscationLimits {
	/** Input is truncated to this many UTF-16 code units; variants never exceed it. */
	maxInputLength: number;
	/** Maximum number of variants returned. */
	maxVariants: number;
	/**
	 * Wall-clock budget, checked between stages: once spent, the remaining stages
	 * are skipped. A regex cannot be interrupted, but every stage is linear in the
	 * (capped) input, so this only bounds how many stages run, not a single one.
	 */
	timeBudgetMs: number;
	/** How many times decoded text may itself be decoded (base64 inside base64). */
	maxDepth: number;
	/**
	 * Total bytes decoded across all snippets and levels. The default is the input
	 * cap, which is more than any one level can decode (base64 yields 3/4 of its
	 * length), so decoys cannot use the budget up before a payload.
	 */
	maxDecodedBytes: number;
}

const DEFAULT_DEOBFUSCATION_LIMITS: DeobfuscationLimits = {
	maxInputLength: MAX_CONTENT_SIZE,
	maxVariants: 8,
	timeBudgetMs: 50,
	maxDepth: 2,
	maxDecodedBytes: MAX_CONTENT_SIZE,
};

// ── Unicode ─────────────────────────────────────────────────────────

/** Zero-width, bidi-control and soft-hyphen characters that split words invisibly. */
const INVISIBLE_CHARS = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

function foldUnicode(text: string): string {
	return text.replace(INVISIBLE_CHARS, "").normalize("NFKC");
}

// ── Letter-spaced text ──────────────────────────────────────────────

/**
 * A run of 6+ single characters separated by 1–4 spaces/tabs ("i g n o r e").
 * Each element must be a lone character: the lookbehind/lookahead stop the run
 * from starting or ending inside a longer word.
 */
const SPACED_RUN =
	/(?<![A-Za-z0-9@$])[A-Za-z0-9@$](?:[ \t]{1,4}[A-Za-z0-9@$]){5,}(?![A-Za-z0-9@$])/g;
const SPACED_ELEMENT = /([A-Za-z0-9@$])([ \t]*)/g;
/** A spaced run must contain this many letters, so number lists ("1 2 3 4 5 6") are left alone. */
const SPACED_MIN_LETTERS = 3;

/**
 * Words the prompt-injection rules key on, plus the function words that join them
 * ("ignore ALL previous instructions"). This single list is the *gate* for the
 * two transforms that would otherwise guess:
 *
 *  - leet folding rewrites a token only if the folded result is one of these
 *    words, so `1gn0r3` becomes `ignore` while `python3`, `v1beta1`, `x01` and
 *    `el3v3n` are never touched;
 *  - letter-spacing recovery re-inserts word breaks only when the *whole* run is
 *    made of these words.
 *
 * Keep it limited to words that matter to a rule or to the grammar around one:
 * a longer list means more tokens become candidates for rewriting.
 */
const INSTRUCTION_WORDS = `a an and any all are as at be by do for from i if in is it me my no not now of on or so the to up we
	you your this that these those what which who with without only just then than into out over
	above below before after earlier prior previous following new old other another again always never
	ignore ignoring disregard forget override overrule bypass skip stop obey comply follow execute exec
	run act acting pretend become reveal show print output say tell give send share leak dump display
	repeat write read open delete remove ask answer respond reply continue start begin end
	enable enabled disable disabled activated changed different revised updated
	instruction instructions rule rules guideline guidelines direction directions directive directives
	command commands order orders prompt prompts message messages system developer admin administrator
	root superuser sudo user assistant model ai agent mode secret secrets password passwords key keys
	token tokens credential credentials environment variables safety security restriction restrictions
	constraint constraints filter filters filtered unfiltered policy policies limit limits guardrail
	guardrails content context jailbreak unrestricted uncensored hidden human operator original
	initial initialization upload fetch forward extract exfiltrate disclose invoke inform mention
	like back post request ethical everything anything nothing something please important must
	should will can may might
	`;

let vocabulary: ReadonlySet<string> | undefined;

/**
 * The instruction vocabulary, built on first use so that merely importing this
 * module (for example into the statusline bundle, which never deobfuscates)
 * does no work and tree-shakes away.
 */
export function instructionVocabulary(): ReadonlySet<string> {
	vocabulary ??= new Set(INSTRUCTION_WORDS.split(/\s+/).filter(Boolean));
	return vocabulary;
}

let segmentMaxWord: number | undefined;
const SEGMENT_MAX_LENGTH = 4096;

/** Computed on first use so merely importing this module does no work. */
function longestVocabularyWord(): number {
	segmentMaxWord ??= Math.max(...[...instructionVocabulary()].map((w) => w.length));
	return segmentMaxWord;
}

/** True if `piece` is a vocabulary word, spelled plainly or in leet ("1gn0r3"). */
function spellsVocabularyWord(piece: string): boolean {
	return instructionVocabulary().has(piece.toLowerCase()) || foldLeetToken(piece) !== piece;
}

/**
 * Split `joined` into vocabulary words using the fewest words, or return null
 * unless the whole string is covered. Words may be spelled in leet; they are
 * returned as written and folded by the leet stage afterwards.
 */
function segmentKnownWords(joined: string): string | null {
	const n = joined.length;
	if (n === 0 || n > SEGMENT_MAX_LENGTH) return null;
	const best = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
	const prev = new Array<number>(n + 1).fill(-1);
	best[0] = 0;
	for (let end = 1; end <= n; end++) {
		let bestHere = Number.POSITIVE_INFINITY;
		for (let len = 1; len <= Math.min(longestVocabularyWord(), end); len++) {
			const start = end - len;
			const words = best[start] ?? Number.POSITIVE_INFINITY;
			if (words + 1 >= bestHere || !spellsVocabularyWord(joined.slice(start, end))) continue;
			bestHere = words + 1;
			best[end] = bestHere;
			prev[end] = start;
		}
	}
	if ((best[n] ?? Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY) return null;
	const words: string[] = [];
	for (let end = n; end > 0; ) {
		const start = prev[end] ?? 0;
		words.push(joined.slice(start, end));
		end = start;
	}
	return words.reverse().join(" ");
}

function collapseSpacedRun(run: string): string {
	const elements: Array<{ ch: string; gap: number }> = [];
	for (const m of run.matchAll(SPACED_ELEMENT)) {
		elements.push({ ch: m[1] ?? "", gap: (m[2] ?? "").length });
	}
	const letters = elements.reduce((n, e) => n + (/[A-Za-z]/.test(e.ch) ? 1 : 0), 0);
	if (letters < SPACED_MIN_LETTERS) return run;

	// Gaps wider than the narrowest gap are word breaks.
	const gaps = elements.slice(0, -1).map((e) => e.gap);
	const minGap = Math.min(...gaps);
	const uniform = gaps.every((g) => g === minGap);
	let out = "";
	elements.forEach((e, i) => {
		out += e.ch;
		if (i < elements.length - 1 && e.gap > minGap) out += " ";
	});
	// A uniform gap carries no word-boundary information: recover boundaries from
	// the vocabulary when the whole run is made of known words, else keep it joined.
	return uniform ? (segmentKnownWords(out) ?? out) : out;
}

function collapseSpaced(text: string): string {
	return text.replace(SPACED_RUN, collapseSpacedRun);
}

// ── Leetspeak ───────────────────────────────────────────────────────

const LEET_MAP: Record<string, string> = {
	"0": "o",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
	"@": "a",
	$: "s",
};

const WORD_TOKEN = /[A-Za-z0-9@$]+/g;
const LETTER = /[A-Za-z]/;
const LEET_CHARS = /[0-9@$]/;
/** Shortest token considered; two-character tokens ("45", "n0") are far too ambiguous. */
const LEET_MIN_TOKEN = 3;

/** Digits plus a single letter: a size or unit suffix ("45K", "500K", "5G"), never leet. */
const NUMBER_WITH_SUFFIX = /^[0-9]+[A-Za-z]$/;

/** "1" is ambiguous (i or l): try both and keep whichever spells a vocabulary word. */
function foldLeetToken(token: string): string {
	if (token.length < LEET_MIN_TOKEN || !LETTER.test(token) || !LEET_CHARS.test(token)) {
		return token;
	}
	if (NUMBER_WITH_SUFFIX.test(token)) return token;
	for (const one of ["i", "l"]) {
		let folded = "";
		for (const ch of token) folded += ch === "1" ? one : (LEET_MAP[ch] ?? ch);
		if (instructionVocabulary().has(folded.toLowerCase())) return folded;
		if (!token.includes("1")) break;
	}
	return token;
}

/** Fold leet in every token that becomes an instruction word; all other text is untouched. */
function foldLeet(text: string): string {
	return text.replace(WORD_TOKEN, foldLeetToken);
}

// ── Base64 / hex decoding ───────────────────────────────────────────

/** 16+ base64/base64url characters, optionally padded, not embedded in a longer token. */
const BASE64_CANDIDATE = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{16,}={0,2}(?![A-Za-z0-9+/=_-])/g;
/** A base64 candidate must be mostly alphanumeric: skips "-----" rules, paths and kebab-case names. */
const BASE64_MIN_ALNUM_RATIO = 0.85;

/** 16+ contiguous hex digits (8+ bytes); a dangling final nibble (truncated payload) is tolerated. */
const HEX_CONTIGUOUS = /(?<![0-9A-Za-z])(?:[0-9A-Fa-f]{2}){8,}[0-9A-Fa-f]?(?![0-9A-Za-z])/g;
/** 6+ `\xNN` escapes. */
const HEX_ESCAPES = /(?:\\x[0-9A-Fa-f]{2}){6,}/g;
/** 8+ hex bytes separated by single spaces, colons, commas or dashes. */
const HEX_SEPARATED = /(?<![0-9A-Za-z])[0-9A-Fa-f]{2}(?:[ :,-][0-9A-Fa-f]{2}){7,}(?![0-9A-Za-z])/g;

/** Decoded snippets shorter than this (in bytes) are too short to carry an instruction. */
const MIN_DECODED_BYTES = 8;
/** Printable-character and letter/space ratios a decoded snippet must reach to count as text. */
const MIN_PRINTABLE_RATIO = 0.95;
const MIN_WORDISH_RATIO = 0.6;
const WORDISH = /[\p{L}\s]/u;
/** Buffer#toString("utf8") substitutes this for invalid sequences instead of throwing. */
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);

/**
 * Return the decoded string only if the bytes are valid UTF-8 that reads as
 * text. Hashes, keys, images, compressed data and JSON/JWT blobs fail one of
 * the checks, which is what keeps encoded-but-benign content from being
 * rewritten into noise.
 */
function decodeIfText(bytes: Buffer): string | null {
	if (bytes.length < MIN_DECODED_BYTES) return null;
	// Decoding never throws (a throwing strict decoder is slow on the random bytes that
	// decoys are made of); invalid UTF-8 shows up as the replacement character instead.
	const text = bytes.toString("utf8");
	if (text.includes(REPLACEMENT_CHAR)) return null;
	let total = 0;
	let printable = 0;
	let wordish = 0;
	for (const ch of text) {
		total++;
		const c = ch.codePointAt(0) ?? 0;
		if ((c >= 0x20 && c < 0x7f) || c === 0x09 || c === 0x0a || c === 0x0d || c >= 0xa0) {
			printable++;
		}
		if (WORDISH.test(ch)) wordish++;
	}
	if (total === 0) return null;
	if (printable / total < MIN_PRINTABLE_RATIO) return null;
	if (wordish / total < MIN_WORDISH_RATIO && !isHexDump(text)) return null;
	return text;
}

/**
 * A hex string is accepted as an intermediate (hex inside base64); the next
 * decoding level still has to produce text for anything to be reported.
 */
function isHexDump(text: string): boolean {
	const digits = text.replace(/\\x|[\s:,-]/g, "");
	return digits.length >= 16 && digits.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(digits);
}

function alnumRatio(s: string): number {
	let n = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) n++;
	}
	return n / s.length;
}

interface DecodeBudget {
	/** Bytes still allowed to be decoded across the whole call. */
	bytesLeft: number;
}

/**
 * Decode each candidate and keep those that read as text, within the byte
 * budget. Failed decodes cost nothing against the budget, so decoys (keys,
 * hashes, random blobs) cannot crowd out a real payload; the work is still
 * linear because the candidates are substrings of a size-capped input.
 */
function decodeCandidates<T>(
	candidates: Iterable<T>,
	toBytes: (candidate: T) => Buffer | null,
	budget: DecodeBudget,
): string | null {
	const decoded: string[] = [];
	for (const candidate of candidates) {
		if (budget.bytesLeft < MIN_DECODED_BYTES) break;
		const bytes = toBytes(candidate);
		if (bytes === null || bytes.length > budget.bytesLeft) continue;
		const text = decodeIfText(bytes);
		if (text === null) continue;
		budget.bytesLeft -= bytes.length;
		decoded.push(text);
	}
	return decoded.length > 0 ? decoded.join("\n") : null;
}

function base64Bytes(candidate: string): Buffer | null {
	const token = candidate.replace(/=+$/, "");
	if (token.length % 4 === 1 || alnumRatio(token) < BASE64_MIN_ALNUM_RATIO) return null;
	if (!LETTER.test(token)) return null;
	return Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hexBytes(candidate: string): Buffer {
	const digits = candidate.replace(/\\x|[^0-9A-Fa-f]/g, "");
	// A dangling final nibble (truncated payload) is dropped.
	return Buffer.from(digits.length % 2 === 1 ? digits.slice(0, -1) : digits, "hex");
}

function decodeBase64Snippets(text: string, budget: DecodeBudget): string | null {
	return decodeCandidates(text.matchAll(BASE64_CANDIDATE), (m) => base64Bytes(m[0]), budget);
}

function decodeHexSnippets(text: string, budget: DecodeBudget): string | null {
	const matches = [HEX_CONTIGUOUS, HEX_ESCAPES, HEX_SEPARATED].flatMap((p) => [
		...text.matchAll(p),
	]);
	return decodeCandidates(matches, (m) => hexBytes(m[0]), budget);
}

// ── Orchestration ───────────────────────────────────────────────────

interface Run {
	limits: DeobfuscationLimits;
	deadline: number;
	seen: Set<string>;
	variants: DeobfuscatedVariant[];
	budget: DecodeBudget;
}

function exhausted(run: Run): boolean {
	return Date.now() > run.deadline || run.variants.length >= run.limits.maxVariants;
}

function addVariant(run: Run, text: string, techniques: DeobfuscationTechnique[]): boolean {
	const { maxInputLength, maxVariants } = run.limits;
	const clamped = text.length > maxInputLength ? text.slice(0, maxInputLength) : text;
	if (run.seen.has(clamped) || run.variants.length >= maxVariants) return false;
	run.seen.add(clamped);
	run.variants.push({ text: clamped, techniques });
	return true;
}

/**
 * Normalize `text` (unicode → spaced → leet, each stage feeding the next), then
 * decode embedded base64/hex and recurse into whatever decoded to text.
 * `prefix` holds the techniques already applied to reach `text`.
 */
function expand(run: Run, text: string, depth: number, prefix: DeobfuscationTechnique[]): void {
	let current = text;
	const applied = [...prefix];

	const folded = foldUnicode(current);
	if (folded !== current) {
		current = folded;
		applied.push("unicode");
		addVariant(run, current, [...applied]);
	}
	const decodeSource = current;

	if (!exhausted(run)) {
		const collapsed = collapseSpaced(current);
		if (collapsed !== current) {
			current = collapsed;
			applied.push("spaced");
			addVariant(run, current, [...applied]);
		}
	}

	if (!exhausted(run)) {
		const leetFolded = foldLeet(current);
		if (leetFolded !== current) addVariant(run, leetFolded, [...applied, "leet"]);
	}

	if (depth >= run.limits.maxDepth) return;

	const decoders: Array<[DeobfuscationTechnique, typeof decodeBase64Snippets]> = [
		["base64", decodeBase64Snippets],
		["hex", decodeHexSnippets],
	];
	for (const [technique, decode] of decoders) {
		if (exhausted(run)) return;
		const decoded = decode(decodeSource, run.budget);
		if (decoded === null) continue;
		const techniques = [...prefix, technique];
		if (addVariant(run, decoded, techniques)) {
			expand(run, decoded, depth + 1, techniques);
		}
	}
}

/**
 * Return deobfuscated variants of `input` (never the input itself, never
 * duplicates). Returns an empty array when nothing could be undone. Never throws.
 */
export function deobfuscate(
	input: string,
	limits: Partial<DeobfuscationLimits> = {},
): DeobfuscatedVariant[] {
	const resolved = { ...DEFAULT_DEOBFUSCATION_LIMITS, ...limits };
	const original =
		input.length > resolved.maxInputLength ? input.slice(0, resolved.maxInputLength) : input;
	const run: Run = {
		limits: resolved,
		deadline: Date.now() + resolved.timeBudgetMs,
		seen: new Set([original]),
		variants: [],
		budget: { bytesLeft: resolved.maxDecodedBytes },
	};
	if (!original) return run.variants;
	try {
		expand(run, original, 0, []);
	} catch {
		// Fail open: return whatever variants were produced before the error.
	}
	return run.variants;
}

// ── Match attribution ───────────────────────────────────────────────

/** Context prefix marking a heuristic match as found in a deobfuscated variant. */
const DEOBFUSCATED_CONTEXT_PREFIX = "deobfuscated:";

/** Match context for a variant produced by `techniques`, e.g. `deobfuscated:base64+leet`. */
export function deobfuscationContext(techniques: readonly DeobfuscationTechnique[]): string {
	return `${DEOBFUSCATED_CONTEXT_PREFIX}${techniques.join("+")}`;
}

/** Human-readable "how was this found" suffix for a match, or "" for a raw match. */
export function describeDeobfuscation(context: string | undefined): string {
	if (!context?.startsWith(DEOBFUSCATED_CONTEXT_PREFIX)) return "";
	return ` [after decoding: ${context.slice(DEOBFUSCATED_CONTEXT_PREFIX.length).replace(/\+/g, ", ")}]`;
}
