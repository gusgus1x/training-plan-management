import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import { createAssessmentRepository, type AssessmentRepository } from "../../app/lib/assessments/repository";
import { createAssessmentService } from "../../app/lib/assessments/service";
import type { AssessmentRecord } from "../../app/lib/assessments/types";
import { parseAssessmentWriteInput, parseCreateAssessmentWriteInput } from "../../app/lib/assessments/validation";

const baseInput = {
  scope: "COMPANY",
  companyId: "99",
  seriesCode: "ASM-SAFETY",
  seriesName: "Safety Test",
  purpose: "PRE_TEST",
  versionNote: null,
  instructions: null,
  passingScorePercent: "80",
  timeLimitMinutes: 30,
  status: "ACTIVE",
  questions: [{
    questionText: "Wear PPE?",
    questionType: "SINGLE_CHOICE",
    questionScore: "1",
    isRequired: true,
    choices: [
      { choiceText: "Yes", isCorrect: true, optionScore: "1" },
      { choiceText: "No", isCorrect: false, optionScore: "0" },
    ],
  }],
};

const stored = {
  assessmentId: "10",
  assessmentSeriesId: "5",
  companyId: "2",
  companyCode: "TEP",
  companyName: "TEP",
  scope: "COMPANY",
  seriesCode: "ASM-SAFETY",
  seriesName: "Safety Test",
  purpose: "PRE_TEST",
  versionNo: 1,
  versionNote: null,
  instructions: null,
  passingScorePercent: "80.00",
  timeLimitMinutes: 30,
  status: "ACTIVE",
  questions: [],
  isUsed: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: null,
} as Omit<AssessmentRecord, "canModify" | "canCreateVersion">;

const principal = (role: "HRD_CENTER" | "HRD_FACTORY", companyId: string | null) => ({
  userId: "1",
  username: "tester",
  role,
  companyId,
} as AuthenticatedPrincipal);

const repository = () => ({
  list: vi.fn().mockResolvedValue({ items: [stored], totalItems: 1 }),
  findById: vi.fn().mockResolvedValue(stored),
  findConflict: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue(stored),
  update: vi.fn().mockResolvedValue(stored),
  createVersion: vi.fn().mockResolvedValue({ ...stored, versionNo: 2, status: "DRAFT" }),
  isLatest: vi.fn().mockResolvedValue(true),
  setStatus: vi.fn().mockResolvedValue({ ...stored, status: "INACTIVE" }),
  delete: vi.fn().mockResolvedValue(stored),
}) as unknown as AssessmentRepository;

describe("assessment V6.2 validation", () => {
  it("normalizes a valid assessment and decimal scores", () => {
    expect(parseAssessmentWriteInput(baseInput)).toMatchObject({
      seriesCode: "ASM-SAFETY",
      purpose: "PRE_TEST",
      passingScorePercent: "80.00",
      questions: [{ questionScore: "1.00" }],
    });
  });

  it("ignores a client-provided code during create", () => {
    expect(parseCreateAssessmentWriteInput({ ...baseInput, seriesCode: "CLIENT-CODE" }).seriesCode).toBe("AUTO");
  });

  it("requires questions before ACTIVE", () => {
    expect(() => parseAssessmentWriteInput({ ...baseInput, questions: [] })).toThrow();
  });

  it("requires exactly one correct answer for single choice", () => {
    const questions = [{
      ...baseInput.questions[0],
      choices: baseInput.questions[0].choices.map((choice) => ({ ...choice, isCorrect: true })),
    }];
    expect(() => parseAssessmentWriteInput({ ...baseInput, questions })).toThrow();
  });
});

describe("assessment company scope and lifecycle", () => {
  it("forces HRD_FACTORY create into the Session company", async () => {
    const repo = repository();
    await createAssessmentService(repo).createAssessment(
      parseAssessmentWriteInput(baseInput),
      principal("HRD_FACTORY", "2"),
    );
    expect(repo.create).toHaveBeenCalledWith(expect.anything(), "2", "1");
  });

  it("does not let HRD_FACTORY modify another company", async () => {
    const repo = repository();
    await expect(createAssessmentService(repo).updateAssessment(
      "10",
      parseAssessmentWriteInput(baseInput),
      principal("HRD_FACTORY", "3"),
    )).rejects.toMatchObject({ code: "ASSESSMENT_SCOPE_FORBIDDEN", status: 403 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("does not allow an auto-generated code to be edited", async () => {
    const repo = repository();
    await expect(createAssessmentService(repo).updateAssessment(
      "10",
      parseAssessmentWriteInput({ ...baseInput, companyId: "2", seriesCode: "ASM-CHANGED" }),
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "ASSESSMENT_CODE_LOCKED", status: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("does not allow the purpose to be edited once the code exists", async () => {
    // The code carries the purpose tag (PRE-/POST-/ASM-) and can never change, so a purpose that
    // moves on its own leaves a GENERAL assessment still named PRE-000002.
    const repo = repository();
    await expect(createAssessmentService(repo).updateAssessment(
      "10",
      parseAssessmentWriteInput({ ...baseInput, companyId: "2", purpose: "GENERAL" }),
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "ASSESSMENT_PURPOSE_LOCKED", status: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("lets an owner retire an assessment that is already in use", async () => {
    // updateAssessment refuses a used assessment outright, which used to make publishing one by
    // mistake permanent - the status path exists so retiring stays possible without touching
    // content anybody has already answered.
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...stored, isUsed: true });
    const result = await createAssessmentService(repo).setAssessmentStatus("10", "INACTIVE", principal("HRD_FACTORY", "2"));
    expect(repo.setStatus).toHaveBeenCalledWith("10", "INACTIVE", "1");
    expect(result.status).toBe("INACTIVE");
  });

  it("still refuses a status change on someone else's assessment", async () => {
    const repo = repository();
    await expect(createAssessmentService(repo).setAssessmentStatus("10", "INACTIVE", principal("HRD_FACTORY", "3")))
      .rejects.toMatchObject({ code: "ASSESSMENT_SCOPE_FORBIDDEN", status: 403 });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it("locks used versions but permits an owner to create the next draft", async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...stored, isUsed: true });
    await expect(createAssessmentService(repo).updateAssessment(
      "10",
      parseAssessmentWriteInput(baseInput),
      principal("HRD_FACTORY", "2"),
    )).rejects.toMatchObject({ code: "ASSESSMENT_LOCKED" });

    await expect(createAssessmentService(repo).createAssessmentVersion(
      "10",
      parseAssessmentWriteInput({ ...baseInput, companyId: "2", status: "DRAFT" }),
      principal("HRD_FACTORY", "2"),
    )).resolves.toMatchObject({ versionNo: 2, status: "DRAFT", canModify: true });
  });
});

describe("assessment repository scope", () => {
  it("keeps Factory company scope when a search filter is present", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = {
      assessment_series: { findMany },
    } as unknown as Parameters<typeof createAssessmentRepository>[0];
    const repo = createAssessmentRepository(client);

    await repo.list(
      { search: "safety", status: null, purpose: null, skip: 0, take: 100 },
      principal("HRD_FACTORY", "2"),
    );

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { OR: [{ company_id: null }, { company_id: BigInt("2") }] },
          { OR: [
            { series_code: { contains: "safety" } },
            { series_name: { contains: "safety" } },
            { company: { company_code: { contains: "safety" } } },
          ] },
        ],
      },
    }));
  });
});
