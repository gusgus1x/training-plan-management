import { describe, expect, it } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import { parseCreateAssessmentWriteInput } from "../../app/lib/assessments/validation";
import { parseCreateCourse, parseUpdateCourse } from "../../app/lib/courses/validation";
import { parseUpdateEnrollment } from "../../app/lib/trainingEnrollment/validation";
import {
  parseCreateOapPlan,
  parseUpdateOapPlan,
} from "../../app/lib/trainingOap/validation";
import {
  parseCreateRollingPlan,
  parseUpdateRollingPlan,
} from "../../app/lib/trainingRolling/validation";

/**
 * Every one of these accepted a string longer than its NVARCHAR column. The value passed validation,
 * reached SQL Server, and came back as "String or binary data would be truncated" — a 500 naming
 * neither the field nor the limit, on an action the user believed had succeeded.
 *
 * Note for anyone extending this: in this Prisma SQL Server schema a bare `String` with no `@db.`
 * attribute maps to NVarChar(1000), which is what made several of these easy to miss.
 */

const tooLong = (limit: number) => "x".repeat(limit + 1);
const atLimit = (limit: number) => "x".repeat(limit);

const refusedField = (run: () => unknown) => {
  try {
    run();
  } catch (error: unknown) {
    if (!(error instanceof ApiError)) throw error;
    const details = error.details as { field?: string; reason?: string } | undefined;
    expect(details?.reason).toMatch(/no more than/);
    return details?.field ?? "";
  }
  throw new Error("Expected the over-long value to be refused, but it was accepted");
};

const choice = (choiceText: string, isCorrect: boolean) => ({
  choiceText,
  isCorrect,
  optionScore: 0,
});

const series = (over: Record<string, unknown>) => ({
  scope: "CENTRAL",
  seriesName: "Series",
  purpose: "PRE_TEST",
  passingScorePercent: 50,
  status: "DRAFT",
  questions: [
    {
      questionText: "Q",
      questionType: "SINGLE_CHOICE",
      questionScore: 1,
      isRequired: true,
      choices: [choice("a", true), choice("b", false)],
    },
  ],
  ...over,
});

const rollingPlan = (over: Record<string, unknown>) => ({
  oapPlanId: "1",
  trainingDate: "2026-03-05",
  startTime: "09:00",
  endTime: "16:00",
  ...over,
});

const oapPlan = (over: Record<string, unknown>) => ({
  courseId: "1",
  planYear: 2026,
  participants: 10,
  hours: 6,
  ...over,
});

const course = (over: Record<string, unknown>) => ({
  courseNameTh: "หลักสูตร",
  courseTypeId: "1",
  courseGroupId: "1",
  standardCode: "STD-001",
  standardName: "Standard",
  targetCompanies: ["1"],
  ...over,
});

describe("validation matches the column widths", () => {
  it.each([
    ["assessment choiceText", 1000, (v: string) =>
      parseCreateAssessmentWriteInput(
        series({
          questions: [
            {
              questionText: "Q",
              questionType: "SINGLE_CHOICE",
              questionScore: 1,
              isRequired: true,
              choices: [choice(v, true), choice("b", false)],
            },
          ],
        }),
      )],
    ["assessment instructions", 1000, (v: string) =>
      parseCreateAssessmentWriteInput(series({ instructions: v }))],
    ["rolling batchName", 100, (v: string) => parseCreateRollingPlan(rollingPlan({ batchName: v }))],
    ["rolling batchName (update)", 100, (v: string) => parseUpdateRollingPlan({ batchName: v })],
    ["rolling venue", 500, (v: string) => parseCreateRollingPlan(rollingPlan({ venue: v }))],
    ["rolling venue (update)", 500, (v: string) => parseUpdateRollingPlan({ venue: v })],
    ["oap trainerName", 255, (v: string) => parseCreateOapPlan(oapPlan({ trainerName: v }))],
    ["oap trainerName (update)", 255, (v: string) => parseUpdateOapPlan({ trainerName: v })],
    ["oap providerName", 255, (v: string) => parseCreateOapPlan(oapPlan({ providerName: v }))],
    ["oap providerName (update)", 255, (v: string) => parseUpdateOapPlan({ providerName: v })],
    ["course remark", 1000, (v: string) => parseCreateCourse(course({ remark: v }))],
    ["course remark (update)", 1000, (v: string) => parseUpdateCourse({ remark: v })],
    ["enrollment reject reason", 1000, (v: string) =>
      parseUpdateEnrollment({ action: "reject", reason: v })],
  ])("refuses %s beyond %i characters", (_label, limit, parse) => {
    refusedField(() => parse(tooLong(limit)));
    // The limit itself has to stay usable — an off-by-one here would reject valid input.
    expect(() => parse(atLimit(limit))).not.toThrow();
  });

  it("leaves course objective unbounded, because its column is NVARCHAR(Max)", () => {
    expect(() =>
      parseCreateCourse(course({ objective: "x".repeat(5000) })),
    ).not.toThrow();
  });
});
