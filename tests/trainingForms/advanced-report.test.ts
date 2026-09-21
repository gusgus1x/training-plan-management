import { describe, expect, it } from "vitest";
import { buildAdvancedReport } from "../../app/lib/trainingForms/advancedReport";
import type {
  EvaluationResponse,
  EvaluationResponseList,
  EvaluationSummary,
  EvaluationSummaryQuestion,
} from "../../app/lib/trainingForms/types";

const course = {
  planCode: "P-1",
  courseName: "หลักสูตรทดสอบ",
  batchName: null,
  startAt: "",
  endAt: "",
  venue: null,
  instructor: null,
  organiser: "CENTER" as const,
};

const question = (
  questionId: string,
  questionType: EvaluationSummaryQuestion["questionType"],
  sectionName: string | null,
  extra: Partial<EvaluationSummaryQuestion> = {},
): EvaluationSummaryQuestion => ({
  questionId,
  questionOrder: Number(questionId),
  questionText: `Q${questionId}`,
  questionType,
  sectionName,
  answeredBy: 1,
  averageRating: null,
  ratingDistribution: questionType === "RATING" ? [{ value: 5, count: 1 }] : [],
  options: [],
  gridRows: [],
  textAnswers: [],
  textAnswersWithheld: false,
  ...extra,
});

const cells = (columns: string[], percents: number[]) =>
  columns.map((columnText, index) => ({ columnId: `c${index}`, columnText, count: 0, percent: percents[index] }));

const summaryOf = (questions: EvaluationSummaryQuestion[]): EvaluationSummary => ({
  evaluationFormId: "1",
  formName: "แบบประเมินหลักสูตร",
  description: null,
  isAnonymous: false,
  timing: "EVALUATION",
  respondentGroup: "EMPLOYEE",
  expectedCount: 2,
  submittedCount: 1,
  responseRatePercent: 50,
  averageAnswerSeconds: null,
  course,
  respondentsByCompany: [{ companyCode: "ATA", companyName: "ATA", count: 1, percent: 100 }],
  questions,
});

const response = (answers: EvaluationResponse["answers"], overrides: Partial<EvaluationResponse> = {}): EvaluationResponse => ({
  responseNo: 1,
  respondentName: "นาย สมชาย ใจดี",
  respondentPosition: null,
  companyCode: "ATA",
  employeeCode: "0001",
  subjectName: null,
  startedAt: null,
  submittedAt: "2026-09-18T03:00:00.000Z",
  answers,
  ...overrides,
});

const responsesOf = (responses: EvaluationResponse[]): EvaluationResponseList => ({
  formName: "แบบประเมินหลักสูตร",
  isAnonymous: false,
  timing: "EVALUATION",
  respondentGroup: "EMPLOYEE",
  questions: [],
  responses,
});

const answer = (questionId: string, overrides: Partial<EvaluationResponse["answers"][number]> = {}) => ({
  questionId,
  choices: [],
  ratingValue: null,
  text: null,
  ...overrides,
});

describe("advanced report for the company workbook", () => {
  it("writes one column per question, and one per row of a single-answer grid", () => {
    const summary = summaryOf([
      question("1", "RATING", "Part 1", { averageRating: 4 }),
      question("2", "MULTIPLE_CHOICE_GRID", "Part 1", {
        gridRows: [
          { rowId: "r1", rowText: "ความชัดเจน", answeredBy: 1, cells: cells(["น้อย", "กลาง", "มาก"], [0, 0, 100]) },
          { rowId: "r2", rowText: "จังหวะ", answeredBy: 0, cells: cells(["น้อย", "กลาง", "มาก"], [0, 0, 0]) },
        ],
      }),
      question("3", "MULTIPLE_CHOICE", "Part 2", {
        options: [
          { optionId: "o1", optionText: "Excel", count: 1, percent: 100 },
          { optionId: "o2", optionText: "Power BI", count: 1, percent: 100 },
        ],
      }),
      question("4", "LONG_TEXT", "Part 2", { textAnswers: ["ดีมาก"] }),
    ]);
    const report = buildAdvancedReport(
      summary,
      responsesOf([
        response([
          answer("1", { ratingValue: 4 }),
          answer("2", { choices: ["ความชัดเจน: มาก"] }),
          answer("3", { choices: ["Excel", "Power BI"] }),
          answer("4", { text: "ดีมาก" }),
        ]),
      ]),
    );

    expect(report.sections.map((section) => section.name)).toEqual(["Part 1", "Part 2"]);
    const [part1, part2] = report.sections;
    expect(part1.questions.map((item) => [item.header, item.kind, item.answers[0], item.outOf])).toEqual([
      ["Q1", "RATING", 4, 5],
      // A grid row is scored by the column picked: "มาก" is the third of three.
      ["Q2 - ความชัดเจน", "RATING", 3, 3],
      ["Q2 - จังหวะ", "RATING", null, 3],
    ]);
    expect(part2.questions[0]).toMatchObject({ kind: "CHOICE", answers: ["Excel; Power BI"] });
    expect(part2.questions[0].split).toEqual([
      { label: "Excel", percent: 100 },
      { label: "Power BI", percent: 100 },
    ]);
    expect(part2.questions[1]).toMatchObject({ kind: "TEXT", answers: ["ดีมาก"] });
    expect(report.companies).toEqual([{ companyCode: "ATA", count: 1 }]);
    expect(report.respondents[0]).toMatchObject({ firstName: "นาย สมชาย", lastName: "ใจดี", employeeCode: "0001", companyCode: "ATA" });
  });

  it("carries a tick-many grid as its own chart data", () => {
    const summary = summaryOf([
      question("1", "CHECKBOX_GRID", null, {
        gridRows: [
          { rowId: "r1", rowText: "หัวข้อ A", answeredBy: 1, cells: cells(["ก่อน", "หลัง"], [100, 0]) },
          { rowId: "r2", rowText: "หัวข้อ B", answeredBy: 1, cells: cells(["ก่อน", "หลัง"], [0, 100]) },
        ],
      }),
    ]);
    const report = buildAdvancedReport(
      summary,
      responsesOf([response([answer("1", { choices: ["หัวข้อ A: ก่อน", "หัวข้อ B: หลัง"] })])]),
    );

    // No section break before it, so the card is the form itself.
    expect(report.sections[0].name).toBe("แบบประเมินหลักสูตร");
    const grid = report.sections[0].questions[0];
    expect(grid.kind).toBe("GRID");
    expect(grid.answers[0]).toBe("หัวข้อ A: ก่อน; หัวข้อ B: หลัง");
    expect(grid.gridSplit).toEqual({
      rows: ["หัวข้อ A", "หัวข้อ B"],
      columns: ["ก่อน", "หลัง"],
      percent: [[100, 0], [0, 100]],
    });
  });

  it("leaves the name columns blank on an anonymous form", () => {
    const summary = { ...summaryOf([question("1", "RATING", null, { averageRating: 5 })]), isAnonymous: true };
    const report = buildAdvancedReport(
      summary,
      responsesOf([
        response([answer("1", { ratingValue: 5 })], { respondentName: null, employeeCode: null, companyCode: "ATA" }),
      ]),
    );

    expect(report.respondents[0]).toMatchObject({ firstName: "", lastName: "", employeeCode: "", companyCode: "ATA" });
  });
});
