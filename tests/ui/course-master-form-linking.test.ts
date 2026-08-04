import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSESSMENT_STORAGE_KEY,
  EVALUATION_STORAGE_KEY,
  readPublishedAssessmentOptions,
  readPublishedEvaluationOptions,
} from "../../app/lib/trainingFormCatalog";

const courseMasterSource = readFileSync(
  new URL(
    "../../app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("training form catalog", () => {
  it("starts with empty catalogs before users create and publish forms", () => {
    expect(readPublishedAssessmentOptions()).toEqual([]);
    expect(readPublishedEvaluationOptions()).toEqual([]);
  });

  it("clears legacy mock form data during the empty-catalog migration", () => {
    const storedValues: Record<string, string> = {
      [ASSESSMENT_STORAGE_KEY]: JSON.stringify([{ id: "legacy-assessment" }]),
      [EVALUATION_STORAGE_KEY]: JSON.stringify([{ id: "legacy-evaluation" }]),
    };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storedValues[key] ?? null,
        removeItem: (key: string) => delete storedValues[key],
        setItem: (key: string, value: string) => {
          storedValues[key] = value;
        },
      },
    });

    expect(readPublishedAssessmentOptions()).toEqual([]);
    expect(storedValues[ASSESSMENT_STORAGE_KEY]).toBeUndefined();
    expect(storedValues[EVALUATION_STORAGE_KEY]).toBeUndefined();
    expect(storedValues["attg-training-form-catalog-version"]).toBe(
      "2026-07-30-empty-v1",
    );
  });

  it("returns only published Pre/Post assessments from browser mock data", () => {
    const storedValues: Record<string, string> = {
      "attg-training-form-catalog-version": "2026-07-30-empty-v1",
      [ASSESSMENT_STORAGE_KEY]: JSON.stringify([
        {
          id: "pre-published",
          assessmentCode: "ASM-010",
          assessmentName: "Published Pre",
          assessmentType: "Pre Test",
          courseName: "Safety",
          status: "Published",
          questions: [{ id: "q1" }],
        },
        {
          id: "post-draft",
          assessmentCode: "ASM-011",
          assessmentName: "Draft Post",
          assessmentType: "Post Test",
          courseName: "Safety",
          status: "Draft",
          questions: [],
        },
      ]),
    };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storedValues[key] ?? null,
        removeItem: (key: string) => delete storedValues[key],
        setItem: (key: string, value: string) => {
          storedValues[key] = value;
        },
      },
    });

    expect(readPublishedAssessmentOptions()).toEqual([
      {
        id: "pre-published",
        code: "ASM-010",
        name: "Published Pre",
        assessmentType: "Pre Test",
        courseName: "Safety",
        questionCount: 1,
      },
    ]);
  });

  it("separates published course and follow-up evaluations", () => {
    const storedValues: Record<string, string> = {
      "attg-training-form-catalog-version": "2026-07-30-empty-v1",
      [EVALUATION_STORAGE_KEY]: JSON.stringify([
        {
          id: "after-training",
          code: "EVA-010",
          name: "Course Feedback",
          timing: "After Training",
          respondent: "Employee",
          scope: "Central",
          company: "-",
          status: "Published",
          questions: [{ id: "q1" }, { id: "q2" }],
        },
        {
          id: "follow-up",
          code: "EVA-011",
          name: "Manager Follow-up",
          timing: "30-Day Follow-up",
          respondent: "Manager",
          scope: "Company",
          company: "SNF",
          status: "Published",
          questions: [{ id: "q3" }],
        },
      ]),
    };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storedValues[key] ?? null,
        removeItem: (key: string) => delete storedValues[key],
        setItem: (key: string, value: string) => {
          storedValues[key] = value;
        },
      },
    });

    expect(readPublishedEvaluationOptions()).toEqual([
      expect.objectContaining({
        id: "after-training",
        timing: "After Training",
        questionCount: 2,
      }),
      expect.objectContaining({
        id: "follow-up",
        timing: "30-Day Follow-up",
        respondent: "Manager",
        questionCount: 1,
      }),
    ]);
  });
});

describe("Course Master form linking contract", () => {
  it("guides users through required course setup fields", () => {
    expect(courseMasterSource).toContain("Course setup guideline");
    expect(courseMasterSource).toContain("requiredCourseValues");
    expect(courseMasterSource).toContain("completedRequiredFields");
    expect(courseMasterSource).toContain("isCourseFormReady");
    expect(courseMasterSource).toContain("Required field completion");
    expect(courseMasterSource).toContain(
      "Generated after selecting a course group",
    );
    expect(courseMasterSource).toContain("disabled={!isCourseFormReady}");
  });

  it("stores stable IDs and legacy display names for all four form links", () => {
    expect(courseMasterSource).toContain("preTestId");
    expect(courseMasterSource).toContain("postTestId");
    expect(courseMasterSource).toContain("evaluationId");
    expect(courseMasterSource).toContain("evaluationAfter30DayId");
    expect(courseMasterSource).toContain("handleAssessmentSelection");
    expect(courseMasterSource).toContain("handleEvaluationSelection");
  });

  it("loads only published form options from the shared catalog", () => {
    expect(courseMasterSource).toContain("readPublishedAssessmentOptions");
    expect(courseMasterSource).toContain("readPublishedEvaluationOptions");
    expect(courseMasterSource).toContain(
      'assessment.assessmentType === "Pre Test"',
    );
    expect(courseMasterSource).toContain(
      'evaluation.timing === "30-Day Follow-up"',
    );
  });

  it("keeps course group values in English while localizing the placeholder", () => {
    expect(courseMasterSource).toContain(
      '<option value="">Select Course Group</option>',
    );
    expect(courseMasterSource).toContain(
      '<option key={group} value={group} translate="no">{group}</option>',
    );
  });
});
