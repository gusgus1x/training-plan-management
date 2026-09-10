import { describe, expect, it } from "vitest";
import { Prisma } from "../../app/generated/prisma/client";
import { createTrainingFormsRepository } from "../../app/lib/trainingForms/repository";

/**
 * readSubmissionForHrd - the marked-up paper HRD reads. Three things are worth guarding: the total
 * it reports, that a written answer nobody has read yet carries no verdict, and that a plan id from
 * one company cannot be paired with a submission from another.
 */

const PLAN_ID = "1";
const SUBMISSION_ID = "9001";

const choice = (id: number, order: number, text: string, isCorrect: boolean) => ({
  choice_id: BigInt(id),
  choice_order: order,
  choice_text: text,
  is_correct: isCorrect,
  axis: null,
});

const buildDb = (opts: { companyId?: bigint | null; planId?: bigint } = {}) => ({
  assessment_submission: {
    findUniqueOrThrow: async () => ({
      submission_id: BigInt(SUBMISSION_ID),
      assessment_stage: "POST_TEST",
      attempt_no: 2,
      submitted_at: new Date("2026-09-01T03:00:00.000Z"),
      pass_status: "PENDING",
      grading_status: "PENDING_REVIEW",
      publication_status: "UNPUBLISHED",
      training_enrollment: {
        enrollment_id: BigInt(7),
        plan_id: opts.planId ?? BigInt(PLAN_ID),
        employee: {
          employee_code: "E1",
          first_name_th: "ทดสอบ",
          last_name_th: "ระบบ",
          first_name_en: null,
          last_name_en: null,
        },
        training_plan: { training_plan_oap: { company_id: opts.companyId ?? BigInt(1) } },
      },
      assessment: {
        passing_score_percent: new Prisma.Decimal(50),
        assessment_question: [
          {
            question_id: BigInt(1),
            question_order: 1,
            question_text: "1 + 1 = ?",
            question_type: "SINGLE_CHOICE",
            question_score: new Prisma.Decimal(60),
            assessment_choice: [choice(11, 1, "2", true), choice(12, 2, "3", false)],
          },
          {
            question_id: BigInt(2),
            question_order: 2,
            question_text: "อธิบายเหตุผล",
            question_type: "SHORT_ANSWER",
            question_score: new Prisma.Decimal(40),
            assessment_choice: [],
          },
          {
            question_id: BigInt(3),
            question_order: 3,
            question_text: "ส่วนที่ 2",
            question_type: "SECTION_BREAK",
            question_score: new Prisma.Decimal(0),
            assessment_choice: [],
          },
        ],
      },
      assessment_answer: [
        {
          answer_id: BigInt(5001),
          question_id: BigInt(1),
          choice_id: BigInt(11),
          row_choice_id: null,
          answer_text: null,
          is_correct: true,
          score_awarded: new Prisma.Decimal(60),
          review_status: "REVIEWED",
          review_comment: null,
        },
        {
          answer_id: BigInt(5002),
          question_id: BigInt(2),
          choice_id: null,
          row_choice_id: null,
          answer_text: "เพราะว่า...",
          is_correct: null,
          score_awarded: null,
          review_status: "PENDING_REVIEW",
          review_comment: null,
        },
      ],
    }),
  },
});

const read = (db: unknown, planId = PLAN_ID) =>
  createTrainingFormsRepository(db as Parameters<typeof createTrainingFormsRepository>[0]).readSubmissionForHrd(
    planId,
    SUBMISSION_ID,
    null,
  );

describe("readSubmissionForHrd", () => {
  it("totals only the scoring questions, leaving blocks out of the denominator", async () => {
    const review = await read(buildDb());

    // 60 + 40. The section break carries no marks and must not join the total, or every paper with
    // one would report a denominator nobody can reach.
    expect(review.totalScore).toBe(100);
    expect(review.scoreAwarded).toBe(60);
  });

  it("gives a written answer no verdict until somebody has read it", async () => {
    const review = await read(buildDb());
    const written = review.questions.find((question) => question.questionOrder === 2)!;

    expect(written.isCorrect).toBeNull();
    expect(written.needsReview).toBe(true);
    expect(written.answerId).toBe("5002");
    expect(written.scoreAwarded).toBeNull();
  });

  it("carries the answer key, which the employee's own review never does", async () => {
    const review = await read(buildDb());
    const multipleChoice = review.questions.find((question) => question.questionOrder === 1)!;

    expect(multipleChoice.choices.map((c) => [c.choiceText, c.isCorrect, c.picked])).toEqual([
      ["2", true, true],
      ["3", false, false],
    ]);
  });

  it("refuses a submission that belongs to a different plan than the one in the URL", async () => {
    // Otherwise a scoped HRD user could pair their own plan id with somebody else's submission.
    await expect(read(buildDb({ planId: BigInt(999) }))).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a factory HRD reading a plan owned by another company", async () => {
    const db = buildDb({ companyId: BigInt(2) });
    const repository = createTrainingFormsRepository(
      db as unknown as Parameters<typeof createTrainingFormsRepository>[0],
    );

    await expect(repository.readSubmissionForHrd(PLAN_ID, SUBMISSION_ID, "1")).rejects.toMatchObject({
      status: 403,
    });
  });
});

/**
 * A grid where one column is picked in more than one row - the case the review grid used to draw
 * with a single tick, because each column carried one `rowId` and `find` returned whichever answer
 * row it met first.
 */
const gridDb = () => ({
  assessment_submission: {
    findUniqueOrThrow: async () => ({
      submission_id: BigInt(SUBMISSION_ID),
      assessment_stage: "POST_TEST",
      attempt_no: 1,
      submitted_at: new Date("2026-09-01T03:00:00.000Z"),
      pass_status: "PASS",
      grading_status: "REVIEWED",
      publication_status: "PUBLISHED",
      training_enrollment: {
        enrollment_id: BigInt(7),
        plan_id: BigInt(PLAN_ID),
        employee: {
          employee_code: "E1",
          first_name_th: "ทดสอบ",
          last_name_th: "ระบบ",
          first_name_en: null,
          last_name_en: null,
        },
        training_plan: { training_plan_oap: { company_id: BigInt(1) } },
      },
      assessment: {
        passing_score_percent: new Prisma.Decimal(50),
        assessment_question: [
          {
            question_id: BigInt(1),
            question_order: 1,
            question_text: "ให้คะแนนแต่ละหัวข้อ",
            question_type: "MULTIPLE_CHOICE_GRID",
            question_score: new Prisma.Decimal(10),
            assessment_choice: [
              { choice_id: BigInt(21), choice_order: 1, choice_text: "หัวข้อ ก", is_correct: false, axis: "ROW" },
              { choice_id: BigInt(22), choice_order: 2, choice_text: "หัวข้อ ข", is_correct: false, axis: "ROW" },
              { choice_id: BigInt(31), choice_order: 3, choice_text: "ดี", is_correct: false, axis: "COLUMN" },
            ],
          },
        ],
      },
      // The same column, picked for both rows.
      assessment_answer: [
        {
          answer_id: BigInt(6001),
          question_id: BigInt(1),
          choice_id: BigInt(31),
          row_choice_id: BigInt(21),
          answer_text: null,
          is_correct: true,
          score_awarded: new Prisma.Decimal(5),
          review_status: "NOT_REQUIRED",
          review_comment: null,
        },
        {
          answer_id: BigInt(6002),
          question_id: BigInt(1),
          choice_id: BigInt(31),
          row_choice_id: BigInt(22),
          answer_text: null,
          is_correct: true,
          score_awarded: new Prisma.Decimal(5),
          review_status: "NOT_REQUIRED",
          review_comment: null,
        },
      ],
    }),
  },
});

describe("readSubmissionForHrd - grids", () => {
  it("reports every row a column was picked for, not just the first", async () => {
    const review = await read(gridDb());
    const column = review.questions[0].choices.find((choice) => choice.axis === "COLUMN")!;

    expect(column.pickedRowIds.sort()).toEqual(["21", "22"]);
    // The rows themselves were never picked as choices; only columns carry the answer.
    for (const row of review.questions[0].choices.filter((choice) => choice.axis === "ROW")) {
      expect(row.pickedRowIds).toEqual([]);
    }
  });
});
