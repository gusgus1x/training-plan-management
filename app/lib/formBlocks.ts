// Non-question rows that can appear in an evaluation or an assessment.
//
// Both live in the existing question tables with these values in question_type, so they interleave
// with real questions using question_order. A SECTION_BREAK starts a new page for the learner; a
// TEXT_BLOCK is a title plus prose with no input. Neither is ever answered or scored.
//
// This sits outside app/lib/evaluations and app/lib/assessments because all three of those plus the
// learner runner need it, and the two lib folders do not import each other.

export const FORM_BLOCK_TYPES = ["SECTION_BREAK", "TEXT_BLOCK"] as const;

export type FormBlockType = (typeof FORM_BLOCK_TYPES)[number];

export const isFormBlockType = (questionType: string): questionType is FormBlockType =>
  (FORM_BLOCK_TYPES as readonly string[]).includes(questionType);

/**
 * A branch target of 0 means "end the form here" - Google Forms' third navigation choice, alongside
 * "continue to next section" (stored as null) and "go to section N" (a 1-based ordinal).
 *
 * It has to be a distinct value rather than the absence of one: null already means "fall through to
 * the next section in order", which is a different instruction. Without this, a section that is
 * only meant to be reached by a branch still spills into whatever section happens to follow it -
 * the single most common way a branched form misbehaves.
 *
 * 0 is safe as the sentinel because section ordinals are 1-based, so it can never collide with a
 * real section, and the column is a plain nullable INT with no range constraint.
 */
export const SUBMIT_SECTION = 0;

/**
 * Label for the default "continue" choice, naming the section it will actually land on.
 *
 * A bare "Continue to next section" hides the whole problem: an author who branched question 1 into
 * sections 2 and 3 reasonably assumes section 2 ends there, and never notices it still falls
 * through into 3. Spelling out the destination makes the default visible instead of implicit.
 */
export const fallThroughLabel = (fromSection: number, sectionCount: number, thai = true): string => {
  if (fromSection >= sectionCount) {
    return thai ? "ไปยังส่วนถัดไป (ไม่มีส่วนถัดไป = จบฟอร์ม)" : "Continue to next section (none left, so the form ends)";
  }
  return thai
    ? `ไปยังส่วนถัดไป (ส่วนที่ ${fromSection + 1})`
    : `Continue to next section (section ${fromSection + 1})`;
};

/** A branch target is a 1-based section ordinal. Section 1 is everything before the first break. */
export const sectionCountOf = (questionTypes: readonly string[]): number =>
  1 + questionTypes.filter((type) => type === "SECTION_BREAK").length;

/**
 * The 1-based section each row sits in, aligned to the input array. The SECTION_BREAK row itself
 * belongs to the section it opens, which is what makes "a branch may only jump forward" a plain
 * `target > sectionOfRow[i]` comparison in validation.
 */
export const sectionIndexPerRow = (questionTypes: readonly string[]): number[] => {
  let current = 1;
  return questionTypes.map((type) => (type === "SECTION_BREAK" ? ++current : current));
};

/**
 * Section ordinals shift whenever a section is moved, added or deleted, so branch targets stored as
 * ordinals must be rewritten to keep pointing at the same section. Identity is the SECTION_BREAK
 * row's own id; section 1 is implicit and always stays section 1.
 *
 * Returns old ordinal -> new ordinal. A section that no longer exists is absent from the map, and
 * callers should drop that target rather than let it point somewhere arbitrary.
 */
export const remapSectionOrdinals = (
  before: ReadonlyArray<{ id: string; questionType: string }>,
  after: ReadonlyArray<{ id: string; questionType: string }>,
): Map<number, number> => {
  const ordinals = (rows: ReadonlyArray<{ id: string; questionType: string }>) => {
    const byId = new Map<string, number>();
    let ordinal = 1;
    for (const row of rows) if (row.questionType === "SECTION_BREAK") byId.set(row.id, ++ordinal);
    return byId;
  };
  const nowAt = ordinals(after);
  // SUBMIT_SECTION maps to itself: "end the form" survives any reordering, since it names no
  // section. Without this entry a reorder would quietly turn every "submit" into "continue".
  const map = new Map<number, number>([[SUBMIT_SECTION, SUBMIT_SECTION], [1, 1]]);
  for (const [id, was] of ordinals(before)) {
    const is = nowAt.get(id);
    if (is !== undefined) map.set(was, is);
  }
  return map;
};

export type BranchRow = {
  questionType: string;
  nextSection: number | null;
  /** Per-option branch targets, in option order. */
  optionTargets: readonly (number | null)[];
};

/**
 * Branch targets must exist and may only jump forward. Forward-only keeps the visited path acyclic,
 * which is what makes "is this required question actually required" answerable at all - with loops,
 * whether a question is reachable depends on answers that depend on reachability.
 *
 * Shared by both validation layers: the rule is identical, only the error type differs, so callers
 * pass their own `invalid`.
 */
export const assertBranchTargets = (
  rows: readonly BranchRow[],
  invalid: (field: string, reason: string) => Error,
) => {
  const types = rows.map((row) => row.questionType);
  const sectionCount = sectionCountOf(types);
  const sectionOfRow = sectionIndexPerRow(types);

  if (types.length && types[types.length - 1] === "SECTION_BREAK") {
    throw invalid(`questions[${types.length - 1}]`, "A section at the end of the form leaves an empty section");
  }

  rows.forEach((row, index) => {
    const from = sectionOfRow[index];
    const targets: Array<[number | null, string]> = [
      [row.nextSection, `questions[${index}].nextSection`],
      ...row.optionTargets.map((target, optionIndex): [number | null, string] =>
        [target, `questions[${index}].options[${optionIndex}].nextSection`]),
    ];
    for (const [target, field] of targets) {
      // null = fall through to the next section, SUBMIT_SECTION = end the form. Neither names a
      // section, so neither is range-checked or subject to the forward-only rule.
      if (target === null || target === SUBMIT_SECTION) continue;
      if (target > sectionCount) throw invalid(field, "Branch target points at a section that does not exist");
      if (target <= from) throw invalid(field, "A branch may only jump forward");
    }
  });
};
