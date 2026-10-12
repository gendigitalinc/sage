import { describe, expect, it } from "vitest";
import { resolveSkillVerdictEntryId } from "../skill-verdict-record.js";

const SKILL_ID = "a".repeat(64);
const ANALYZED_AT = "2026-09-14T10:00:00.000Z";

describe("resolveSkillVerdictEntryId", () => {
	it("returns the stored entry id when the row has one", () => {
		const id = resolveSkillVerdictEntryId(SKILL_ID, {
			entryId: "11111111-1111-1111-1111-111111111111",
			analyzedAt: ANALYZED_AT,
		});
		expect(id).toBe("11111111-1111-1111-1111-111111111111");
	});

	it("derives an RFC 4122 UUIDv5 for rows written before entry ids were persisted", () => {
		const id = resolveSkillVerdictEntryId(SKILL_ID, { analyzedAt: ANALYZED_AT });
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it("derives the same id every time, so listing and reporting agree", () => {
		const first = resolveSkillVerdictEntryId(SKILL_ID, { analyzedAt: ANALYZED_AT });
		const second = resolveSkillVerdictEntryId(SKILL_ID, { analyzedAt: ANALYZED_AT });
		expect(second).toBe(first);
	});

	it("ignores skill id casing, matching how callers normalize it", () => {
		const lower = resolveSkillVerdictEntryId(SKILL_ID, { analyzedAt: ANALYZED_AT });
		const upper = resolveSkillVerdictEntryId(SKILL_ID.toUpperCase(), { analyzedAt: ANALYZED_AT });
		expect(upper).toBe(lower);
	});

	it("gives a re-analysis of the same skill its own id", () => {
		const first = resolveSkillVerdictEntryId(SKILL_ID, { analyzedAt: ANALYZED_AT });
		const later = resolveSkillVerdictEntryId(SKILL_ID, {
			analyzedAt: "2026-09-14T11:00:00.000Z",
		});
		expect(later).not.toBe(first);
	});

	it("separates two skills analyzed at the same instant", () => {
		const a = resolveSkillVerdictEntryId(SKILL_ID, { analyzedAt: ANALYZED_AT });
		const b = resolveSkillVerdictEntryId("b".repeat(64), { analyzedAt: ANALYZED_AT });
		expect(b).not.toBe(a);
	});
});
