import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import { createEvaluationRepository, type EvaluationRepository } from "../../app/lib/evaluations/repository";
import { createEvaluationService } from "../../app/lib/evaluations/service";
import type { EvaluationRecord } from "../../app/lib/evaluations/types";
import { parseCreateEvaluationWriteInput, parseEvaluationWriteInput } from "../../app/lib/evaluations/validation";

const baseInput = {
  scope: "COMPANY",
  companyId: "99",
  formCode: "EVA-KEEP",
  formName: "Post Training Evaluation",
  description: null,
  timing: "AFTER_TRAINING",
  respondentType: "EMPLOYEE",
  isAnonymous: true,
  status: "DRAFT",
  questions: [{
    questionText: "How satisfied are you?",
    questionType: "RATING",
    sectionName: "Course Content",
    isRequired: true,
    options: [
      { optionText: "1", optionValue: "1" },
      { optionText: "2", optionValue: "2" },
      { optionText: "3", optionValue: "3" },
      { optionText: "4", optionValue: "4" },
      { optionText: "5", optionValue: "5" },
    ],
  }],
};

const stored = {
  evaluationFormId: "10",
  companyId: "2",
  companyCode: "TEP",
  companyName: "TEP",
  scope: "COMPANY",
  formCode: "EVA-010",
  formName: "Post Training Evaluation",
  description: null,
  timing: "AFTER_TRAINING",
  respondentType: "EMPLOYEE",
  isAnonymous: true,
  status: "DRAFT",
  questions: [],
  isUsed: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: null,
} as Omit<EvaluationRecord, "canModify" | "canDuplicate">;

const principal = (role: "HRD_CENTER" | "HRD_FACTORY", companyId: string | null) => ({
  userId: "1",
  username: "tester",
  role,
  companyId,
} as AuthenticatedPrincipal);

const repository = () => ({
  list: vi.fn().mockResolvedValue({ items: [stored], totalItems: 1 }),
  findById: vi.fn().mockResolvedValue(stored),
  create: vi.fn().mockResolvedValue(stored),
  update: vi.fn().mockResolvedValue(stored),
  delete: vi.fn().mockResolvedValue(stored),
}) as unknown as EvaluationRepository;

describe("evaluation V6.2 validation", () => {
  it("normalizes valid write input", () => {
    expect(parseEvaluationWriteInput(baseInput)).toMatchObject({
      formCode: "EVA-KEEP",
      timing: "AFTER_TRAINING",
      respondentType: "EMPLOYEE",
      isAnonymous: true,
    });
  });

  it("ignores client form code during create", () => {
    expect(parseCreateEvaluationWriteInput({ ...baseInput, formCode: "CLIENT-CODE" }).formCode).toBe("AUTO");
  });

  it("requires five rating options with values 1..5", () => {
    const bad = {
      ...baseInput,
      questions: [{
        ...baseInput.questions[0],
        options: [{ optionText: "1", optionValue: "1" }],
      }],
    };
    expect(() => parseEvaluationWriteInput(bad)).toThrow();
  });

  it("requires at least one required question before PUBLISHED", () => {
    const noRequired = {
      ...baseInput,
      status: "PUBLISHED",
      questions: [{
        ...baseInput.questions[0],
        isRequired: false,
      }],
    };
    expect(() => parseEvaluationWriteInput(noRequired)).toThrow();
  });
});

describe("evaluation company scope and lifecycle", () => {
  it("forces HRD_FACTORY create into Session company", async () => {
    const repo = repository();
    await createEvaluationService(repo).createEvaluation(
      parseEvaluationWriteInput(baseInput),
      principal("HRD_FACTORY", "2"),
    );
    expect(repo.create).toHaveBeenCalledWith(expect.anything(), "2", "1");
  });

  it("does not let HRD_FACTORY modify another company", async () => {
    const repo = repository();
    await expect(createEvaluationService(repo).updateEvaluation(
      "10",
      parseEvaluationWriteInput(baseInput),
      principal("HRD_FACTORY", "3"),
    )).rejects.toMatchObject({ code: "EVALUATION_SCOPE_FORBIDDEN", status: 403 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("does not allow auto-generated evaluation code to be edited", async () => {
    const repo = repository();
    await expect(createEvaluationService(repo).updateEvaluation(
      "10",
      parseEvaluationWriteInput({ ...baseInput, companyId: "2", formCode: "EVA-CHANGED" }),
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "EVALUATION_CODE_LOCKED", status: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("blocks invalid status transition", async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...stored, status: "PUBLISHED" });
    await expect(createEvaluationService(repo).updateEvaluation(
      "10",
      parseEvaluationWriteInput({ ...baseInput, companyId: "2", formCode: "EVA-010", status: "DRAFT" }),
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "EVALUATION_STATUS_TRANSITION_INVALID", status: 409 });
  });

  it("locks used forms for update and delete", async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...stored, isUsed: true });
    await expect(createEvaluationService(repo).updateEvaluation(
      "10",
      parseEvaluationWriteInput(baseInput),
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "EVALUATION_LOCKED", status: 409 });

    await expect(createEvaluationService(repo).deleteEvaluation(
      "10",
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "EVALUATION_IN_USE", status: 409 });
  });
});

describe("evaluation repository scope", () => {
  it("keeps Factory company scope when search filter is present", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const client = {
      evaluation_form: { findMany, count },
    } as unknown as Parameters<typeof createEvaluationRepository>[0];
    const repo = createEvaluationRepository(client);

    await repo.list(
      { search: "eval", status: null, timing: null, respondentType: null, skip: 0, take: 100 },
      principal("HRD_FACTORY", "2"),
    );

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { OR: [{ company_id: null }, { company_id: BigInt("2") }] },
          { OR: [
            { form_code: { contains: "eval" } },
            { form_name: { contains: "eval" } },
            { company: { company_code: { contains: "eval" } } },
            { description: { contains: "eval" } },
          ] },
        ],
      },
    }));
  });
});

/** ApiError puts the human-readable cause in details.reason; the message is always generic. */
const reasonOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as { details?: { reason?: string } }).details?.reason ?? String(error);
  }
  throw new Error("expected the input to be rejected, but it was accepted");
};

describe("parseEvaluationWriteInput - sections and text blocks", () => {
  const question = (extra: Record<string, unknown> = {}) => ({
    questionText: "How satisfied are you?",
    questionType: "SINGLE_CHOICE",
    sectionName: null,
    isRequired: true,
    options: [
      { optionText: "Yes", optionValue: null },
      { optionText: "No", optionValue: null },
    ],
    ...extra,
  });
  const sectionBreak = (extra: Record<string, unknown> = {}) => ({
    questionText: "Part two",
    questionType: "SECTION_BREAK",
    sectionName: null,
    isRequired: false,
    options: [],
    ...extra,
  });
  const parse = (questions: unknown[], extra: Record<string, unknown> = {}) =>
    parseEvaluationWriteInput({ ...baseInput, ...extra, questions });

  it("accepts a section break and a text block alongside real questions", () => {
    const parsed = parse([
      question(),
      sectionBreak({ questionDescription: "Second half" }),
      question({ questionText: "And now?" }),
    ]);
    expect(parsed.questions.map((q) => q.questionType)).toEqual(["SINGLE_CHOICE", "SECTION_BREAK", "SINGLE_CHOICE"]);
    expect(parsed.questions[1].questionDescription).toBe("Second half");
  });

  it("rejects a section break that carries options", () => {
    const reason = reasonOf(() => parse([
      question(),
      sectionBreak({ options: [{ optionText: "Nope", optionValue: null }] }),
      question(),
    ]));
    expect(reason).toMatch(/must not contain options/);
  });

  it("rejects a section break marked required", () => {
    const reason = reasonOf(() => parse([question(), sectionBreak({ isRequired: true }), question()]));
    expect(reason).toMatch(/cannot be a required question/);
  });

  it("rejects a branch that jumps backwards", () => {
    // Forward-only is what keeps the visited path acyclic; see app/lib/formBlocks.
    const reason = reasonOf(() => parse([
      question(),
      sectionBreak(),
      question({ options: [
        { optionText: "Back", optionValue: null, nextSection: 1 },
        { optionText: "No", optionValue: null },
      ] }),
    ]));
    expect(reason).toMatch(/only jump forward/);
  });

  it("rejects a branch target past the last section", () => {
    const reason = reasonOf(() => parse([
      question({ options: [
        { optionText: "Far", optionValue: null, nextSection: 9 },
        { optionText: "No", optionValue: null },
      ] }),
      sectionBreak(),
      question(),
    ]));
    expect(reason).toMatch(/does not exist/);
  });

  it("rejects a branch on a multi-select, which has no single answer to branch on", () => {
    const reason = reasonOf(() => parse([
      question({ questionType: "MULTIPLE_CHOICE", options: [
        { optionText: "A", optionValue: null, nextSection: 2 },
        { optionText: "B", optionValue: null },
      ] }),
      sectionBreak(),
      question(),
    ]));
    expect(reason).toMatch(/single-choice/);
  });

  it("rejects a trailing section break, which would leave an empty section", () => {
    expect(reasonOf(() => parse([question(), sectionBreak()]))).toMatch(/empty section/);
  });

  it("will not publish a form made of nothing but blocks", () => {
    const reason = reasonOf(() => parse([
      question({ questionText: "Note", questionType: "TEXT_BLOCK", isRequired: false, options: [] }),
    ], { status: "PUBLISHED" }));
    expect(reason).toMatch(/at least one question/);
  });
});

describe("SUBMIT_SECTION in validation", () => {
  const question = (extra: Record<string, unknown> = {}) => ({
    questionText: "Pick one",
    questionType: "SINGLE_CHOICE",
    sectionName: null,
    isRequired: true,
    options: [{ optionText: "Yes", optionValue: null }, { optionText: "No", optionValue: null }],
    ...extra,
  });
  const sectionBreak = (extra: Record<string, unknown> = {}) => ({
    questionText: "Part two",
    questionType: "SECTION_BREAK",
    sectionName: null,
    isRequired: false,
    options: [],
    ...extra,
  });
  const parse = (questions: unknown[]) => parseEvaluationWriteInput({ ...baseInput, questions });

  it("accepts 0 on a section, meaning submit the form here", () => {
    // 0 is exempt from the forward-only rule: it names no section, so "may only jump forward" does
    // not apply to it.
    const parsed = parse([question(), sectionBreak({ nextSection: 0 }), question()]);
    expect(parsed.questions[1].nextSection).toBe(0);
  });

  it("accepts 0 on an option", () => {
    const parsed = parse([
      question({ options: [
        { optionText: "Done", optionValue: null, nextSection: 0 },
        { optionText: "Carry on", optionValue: null },
      ] }),
      sectionBreak(),
      question(),
    ]);
    expect(parsed.questions[0].options[0].nextSection).toBe(0);
  });

  it("still rejects a negative target", () => {
    expect(reasonOf(() => parse([question(), sectionBreak({ nextSection: -1 }), question()])))
      .toMatch(/whole number/);
  });
});
