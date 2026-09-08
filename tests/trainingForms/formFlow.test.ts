import { describe, expect, it } from "vitest";
import {
  resolveNextSection,
  splitSections,
  visitedItems,
  visitedPath,
  type FlowItem,
} from "../../app/lib/trainingForms/formFlow";
import { fallThroughLabel, remapSectionOrdinals, SUBMIT_SECTION } from "../../app/lib/formBlocks";

const question = (id: string, extra: Partial<FlowItem> = {}): FlowItem => ({
  questionId: id,
  type: "SINGLE_CHOICE",
  isRequired: false,
  nextSection: null,
  options: [],
  ...extra,
});

const sectionBreak = (id: string, nextSection: number | null = null): FlowItem =>
  question(id, { type: "SECTION_BREAK", nextSection });

/**
 * Three sections. The branching question in section 1 sends "skip" straight to section 3, and
 * section 2 holds a required question so a skip has something to prove.
 */
const form = (): FlowItem[] => [
  question("q1", {
    options: [{ id: "stay", nextSection: null }, { id: "skip", nextSection: 3 }],
  }),
  sectionBreak("s2"),
  question("q2", { isRequired: true, type: "SHORT_TEXT" }),
  sectionBreak("s3"),
  question("q3", { type: "SHORT_TEXT" }),
];

describe("splitSections", () => {
  it("puts everything before the first break in section 1", () => {
    const sections = splitSections(form());
    expect(sections.map((section) => section.index)).toEqual([1, 2, 3]);
    expect(sections[0].items.map((item) => item.questionId)).toEqual(["q1"]);
  });

  it("keeps the break row as its own section's first item, so it can render as the heading", () => {
    const sections = splitSections(form());
    expect(sections[1].items.map((item) => item.questionId)).toEqual(["s2", "q2"]);
  });

  it("returns a single empty section for a form with no items", () => {
    expect(splitSections([])).toEqual([{ index: 1, items: [] }]);
  });
});

describe("visitedPath", () => {
  it("walks every section in order when nothing branches", () => {
    expect(visitedPath(splitSections(form()), { q1: ["stay"] })).toEqual([1, 2, 3]);
  });

  it("skips the section a branch jumps over", () => {
    expect(visitedPath(splitSections(form()), { q1: ["skip"] })).toEqual([1, 3]);
  });

  it("leaves a skipped section's required question off the visited set", () => {
    // This is the whole point of deriving required-ness from the path: q2 is required, but a
    // learner who branched past it must still be able to submit.
    const visited = visitedItems(splitSections(form()), { q1: ["skip"] });
    expect(visited.map((item) => item.questionId)).toEqual(["q1", "q3"]);
    expect(visited.some((item) => item.isRequired)).toBe(false);
  });

  it("never yields a block row as an answerable item", () => {
    // Both block kinds are present: the two section breaks from the fixture plus a text block.
    const items = [...form(), question("note", { type: "TEXT_BLOCK" })];
    const visited = visitedItems(splitSections(items), { q1: ["stay"] });
    expect(visited.map((item) => item.questionId)).toEqual(["q1", "q2", "q3"]);
  });
});

describe("resolveNextSection", () => {
  it("returns null past the last section, which is what ends the form", () => {
    expect(resolveNextSection(splitSections(form()), 3, {})).toBeNull();
  });

  it("returns null when a branch points past the last section", () => {
    const items = [question("q1", { options: [{ id: "end", nextSection: 2 }] }), sectionBreak("s2")];
    // Section 2 is the last one, so leaving it finishes the form.
    expect(resolveNextSection(splitSections(items), 2, { q1: ["end"] })).toBeNull();
  });

  it("honours the section's own default target over plain sequence", () => {
    const items = [question("q1"), sectionBreak("s2", 4), question("q2"), sectionBreak("s3"), question("q3"), sectionBreak("s4"), question("q4")];
    expect(resolveNextSection(splitSections(items), 2, {})).toBe(4);
  });

  it("lets an option target beat the section default", () => {
    const items = [
      question("q1"),
      sectionBreak("s2", 4),
      question("q2", { options: [{ id: "three", nextSection: 3 }] }),
      sectionBreak("s3"),
      question("q3"),
      sectionBreak("s4"),
      question("q4"),
    ];
    expect(resolveNextSection(splitSections(items), 2, { q2: ["three"] })).toBe(3);
  });

  it("ignores a multi-select, which has no single answer to branch on", () => {
    const items = [
      question("q1", {
        type: "MULTIPLE_CHOICE",
        options: [{ id: "a", nextSection: 3 }, { id: "b", nextSection: null }],
      }),
      sectionBreak("s2"),
      question("q2"),
      sectionBreak("s3"),
      question("q3"),
    ];
    expect(resolveNextSection(splitSections(items), 1, { q1: ["a", "b"] })).toBe(2);
  });
});

describe("SUBMIT_SECTION — ending the form early", () => {
  /**
   * The case that prompted this: question 1 branches "ก" to section 2 and "ข" to section 3.
   * Answering "ก" should walk section 2 and then finish, but section 2's own default is
   * "continue to next section", so it fell through into section 3 — a section meant only for the
   * "ข" path. Google Forms behaves the same way; the fix is that a section can now say
   * "submit form" (SUBMIT_SECTION) instead of falling through.
   */
  const twoBranches = (section2Ends: boolean): FlowItem[] => [
    question("q1", {
      options: [{ id: "ko", nextSection: 2 }, { id: "kho", nextSection: 3 }],
    }),
    sectionBreak("s2", section2Ends ? SUBMIT_SECTION : null),
    question("q2", { type: "SHORT_TEXT" }),
    sectionBreak("s3"),
    question("q3", { type: "SHORT_TEXT" }),
  ];

  it("falls through into the other branch's section when nothing ends it (the reported bug)", () => {
    expect(visitedPath(splitSections(twoBranches(false)), { q1: ["ko"] })).toEqual([1, 2, 3]);
  });

  it("stops after the branch's own section once it is set to submit", () => {
    expect(visitedPath(splitSections(twoBranches(true)), { q1: ["ko"] })).toEqual([1, 2]);
  });

  it("still reaches section 3 on the other answer", () => {
    expect(visitedPath(splitSections(twoBranches(true)), { q1: ["kho"] })).toEqual([1, 3]);
  });

  it("treats a submit target as the end, not as a falsy 'no target'", () => {
    // SUBMIT_SECTION is 0, so a `||` anywhere in the resolution chain would silently fall back to
    // the section default and reintroduce the bug.
    const sections = splitSections(twoBranches(true));
    expect(resolveNextSection(sections, 2, { q1: ["ko"] })).toBeNull();
  });

  it("lets a single option end the form directly", () => {
    const items: FlowItem[] = [
      question("q1", { options: [{ id: "done", nextSection: SUBMIT_SECTION }, { id: "on", nextSection: null }] }),
      sectionBreak("s2"),
      question("q2", { type: "SHORT_TEXT" }),
    ];
    expect(visitedPath(splitSections(items), { q1: ["done"] })).toEqual([1]);
    expect(visitedPath(splitSections(items), { q1: ["on"] })).toEqual([1, 2]);
  });
});

describe("remapSectionOrdinals with a submit target", () => {
  const row = (id: string, questionType: string) => ({ id, questionType });

  it("keeps a submit target as submit when sections are reordered", () => {
    // Without an explicit identity entry for SUBMIT_SECTION the lookup misses, the caller falls
    // back to null, and every "submit form" silently degrades to "continue to next section" the
    // first time anyone drags a section.
    const before = [row("q1", "SINGLE_CHOICE"), row("s2", "SECTION_BREAK"), row("s3", "SECTION_BREAK")];
    const after = [row("q1", "SINGLE_CHOICE"), row("s3", "SECTION_BREAK"), row("s2", "SECTION_BREAK")];
    const map = remapSectionOrdinals(before, after);
    expect(map.get(SUBMIT_SECTION)).toBe(SUBMIT_SECTION);
    // s2 was section 2 and is now section 3; s3 was 3 and is now 2.
    expect(map.get(2)).toBe(3);
    expect(map.get(3)).toBe(2);
  });
});

describe("fallThroughLabel", () => {
  it("names the section the default will actually land on, in both languages", () => {
    // The bare "Continue to next section" is what hid a fall-through into another branch's
    // section; naming the destination is the whole point of this label.
    expect(fallThroughLabel(2, 4, true)).toBe("ไปยังส่วนถัดไป (ส่วนที่ 3)");
    expect(fallThroughLabel(2, 4, false)).toBe("Continue to next section (section 3)");
  });

  it("says the form ends when there is no next section", () => {
    expect(fallThroughLabel(4, 4, false)).toBe("Continue to next section (none left, so the form ends)");
    expect(fallThroughLabel(4, 4, true)).toContain("จบฟอร์ม");
  });
});
