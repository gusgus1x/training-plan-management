import { describe, expect, it } from "vitest";
import { blankDraft, blankItem, validateDraft, type FormDraft } from "../../app/components/forms/formDraft";

/**
 * Every rule here restates one the services already enforce. The point of saying it on the screen
 * is that a 409 names the whole form, while these name the field, so what matters is that a draft
 * this accepts is one the server will accept too - and that nothing is called wrong too early.
 */

const named = (over: Partial<FormDraft> = {}): FormDraft => {
  const draft = blankDraft("assessment", null, false);
  const question = { ...blankItem("SINGLE_CHOICE"), text: "ใส่หมวกนิรภัยเมื่อไร" };
  return {
    ...draft,
    name: "ความปลอดภัย",
    items: [{ ...question, options: question.options.map((option, index) => ({ ...option, isCorrect: index === 0 })) }],
    ...over,
  };
};

const codes = (draft: FormDraft, publishing = false) =>
  validateDraft(draft, "assessment", publishing).map((issue) => issue.code);

describe("what the builder refuses to save", () => {
  it("passes a form that is finished", () => {
    expect(codes(named())).toEqual([]);
  });

  it("wants a name", () => {
    expect(codes(named({ name: "  " }))).toContain("NAME_REQUIRED");
  });

  it("keeps the passing score inside 0 to 100", () => {
    expect(codes(named({ passingScorePercent: "120" }))).toContain("PASS_RANGE");
    expect(codes(named({ passingScorePercent: "0" }))).not.toContain("PASS_RANGE");
  });

  it("takes no time limit at all, but not a nonsense one", () => {
    expect(codes(named({ timeLimitMinutes: "" }))).not.toContain("TIME_POSITIVE");
    expect(codes(named({ timeLimitMinutes: "0" }))).toContain("TIME_POSITIVE");
    expect(codes(named({ timeLimitMinutes: "1.5" }))).toContain("TIME_POSITIVE");
  });

  it("asks for one answer key on a single choice and any number on a multiple choice", () => {
    const single = named();
    const noKey = {
      ...single,
      items: single.items.map((item) => ({
        ...item,
        options: item.options.map((option) => ({ ...option, isCorrect: false })),
      })),
    };
    expect(codes(noKey)).toContain("ONE_CORRECT");

    const multiple = {
      ...noKey,
      items: noKey.items.map((item) => ({ ...item, type: "MULTIPLE_CHOICE" as const })),
    };
    expect(codes(multiple)).toContain("SOME_CORRECT");
  });

  it("catches a blank option and a blank question", () => {
    const draft = named();
    const blanks = {
      ...draft,
      items: draft.items.map((item) => ({
        ...item,
        text: "",
        options: item.options.map((option, index) => (index === 0 ? { ...option, text: " " } : option)),
      })),
    };
    expect(codes(blanks)).toContain("TEXT_REQUIRED");
    expect(codes(blanks)).toContain("OPTION_TEXT");
  });

  it("only demands a question when the form is being published", () => {
    const empty = named({ items: [blankItem("SECTION_BREAK")] });

    expect(codes(empty, false)).not.toContain("NEED_QUESTION");
    expect(codes(empty, true)).toContain("NEED_QUESTION");
  });

  it("says nothing about a score on an evaluation, which has none", () => {
    const evaluation: FormDraft = { ...blankDraft("evaluation", null, false), name: "ความพึงพอใจ" };
    const withText = {
      ...evaluation,
      items: evaluation.items.map((item) => ({ ...item, text: "วิทยากรอธิบายชัดเจน" })),
    };

    expect(validateDraft(withText, "evaluation", true).map((issue) => issue.code)).toEqual([]);
  });
});
