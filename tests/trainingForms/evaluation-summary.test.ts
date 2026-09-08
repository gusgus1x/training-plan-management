import { describe, expect, it } from "vitest";
import { Prisma } from "../../app/generated/prisma/client";
import { createTrainingFormsRepository } from "../../app/lib/trainingForms/repository";
import { FREE_TEXT_MIN_RESPONDENTS } from "../../app/lib/trainingForms/types";

/**
 * readEvaluationSummary against a hand-built fake of the Prisma calls it makes. The two things
 * worth guarding are the two that are easy to get wrong and expensive when wrong: counting people
 * rather than answer rows, and never handing a screen anything that identifies a respondent.
 */

const FORM_ID = BigInt(900);
const PLAN_ID = "77";

type FakeAnswer = {
  evaluation_question_id: bigint;
  evaluation_option_id: bigint | null;
  rating_value: Prisma.Decimal | null;
  answer_text: string | null;
  /** Grid answers only. Deliberately optional: rows written before this column existed, and the
   *  fixtures above, leave it absent, which the summary has to treat as "not a grid answer". */
  row_option_id?: bigint | null;
};

const answer = (overrides: Partial<FakeAnswer> & { evaluation_question_id: bigint }): FakeAnswer => ({
  evaluation_option_id: null,
  rating_value: null,
  answer_text: null,
  ...overrides,
});

const buildFakeDb = (opts: {
  enrolledCount?: number;
  submissions?: { evaluation_submission_id: bigint; evaluation_answer: FakeAnswer[] }[];
  companyId?: bigint | null;
  /** Overrides the default two-question form; used by the grid tests. */
  questions?: unknown[];
}) => {
  const db = {
    training_plan: {
      findUniqueOrThrow: async () => ({
        training_plan_oap: {
          company_id: opts.companyId ?? BigInt(2),
          course: {
            pre_assessment_id: null,
            pre_test_link: null,
            post_assessment_id: null,
            post_test_link: null,
            evaluation_form_id: FORM_ID,
            evaluation_form_after_30day_id: null,
          },
        },
      }),
    },
    evaluation_form: {
      findUniqueOrThrow: async () => ({
        evaluation_form_id: FORM_ID,
        form_name: "Standard Course Evaluation",
        description: "โปรดตอบตามความจริง",
        is_anonymous: true,
        evaluation_question: opts.questions ?? [
          {
            evaluation_question_id: BigInt(1),
            question_order: 1,
            question_text: "สิ่งที่ได้จากหลักสูตร (ตอบได้หลายข้อ)",
            question_type: "MULTIPLE_CHOICE",
            section_name: "Course Content",
            evaluation_option: [
              { evaluation_option_id: BigInt(11), option_text: "ความรู้" },
              { evaluation_option_id: BigInt(12), option_text: "ทักษะ" },
              { evaluation_option_id: BigInt(13), option_text: "เครือข่าย" },
            ],
          },
          {
            evaluation_question_id: BigInt(2),
            question_order: 2,
            question_text: "ข้อเสนอแนะเพิ่มเติม",
            question_type: "LONG_TEXT",
            section_name: "Comments",
            evaluation_option: [],
          },
        ],
      }),
    },
    training_enrollment: { count: async () => opts.enrolledCount ?? 10 },
    evaluation_submission: { findMany: async () => opts.submissions ?? [] },
  };

  return createTrainingFormsRepository(db as unknown as Parameters<typeof createTrainingFormsRepository>[0]);
};

describe("readEvaluationSummary", () => {
  it("counts one respondent once even when they tick several options", async () => {
    // evaluation_answer stores one row per selected option. Counting rows would report a single
    // person who ticked all three as three respondents, pushing every percentage over 100.
    const repository = buildFakeDb({
      enrolledCount: 4,
      submissions: [
        {
          evaluation_submission_id: BigInt(1),
          evaluation_answer: [
            answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(11) }),
            answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(12) }),
            answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(13) }),
          ],
        },
        {
          evaluation_submission_id: BigInt(2),
          evaluation_answer: [answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(11) })],
        },
      ],
    });

    const summary = await repository.readEvaluationSummary(PLAN_ID, "EVALUATION", null);
    const question = summary!.questions[0];

    expect(summary!.submittedCount).toBe(2);
    expect(summary!.enrolledCount).toBe(4);
    expect(summary!.responseRatePercent).toBe(50);
    expect(question.answeredBy).toBe(2);

    const [knowledge, skill, network] = question.options;
    expect(knowledge.count).toBe(2);
    expect(knowledge.percent).toBe(100);
    expect(skill.count).toBe(1);
    expect(skill.percent).toBe(50);
    expect(network.count).toBe(1);
  });

  it("withholds free text until enough people have answered", async () => {
    const submissions = Array.from({ length: FREE_TEXT_MIN_RESPONDENTS - 1 }, (_, index) => ({
      evaluation_submission_id: BigInt(index + 1),
      evaluation_answer: [answer({ evaluation_question_id: BigInt(2), answer_text: `comment ${index}` })],
    }));

    const summary = await buildFakeDb({ submissions }).readEvaluationSummary(PLAN_ID, "EVALUATION", null);
    const comments = summary!.questions[1];

    expect(comments.textAnswersWithheld).toBe(true);
    expect(comments.textAnswers).toEqual([]);
    // The count is still reported - how many answered is not itself identifying.
    expect(comments.answeredBy).toBe(FREE_TEXT_MIN_RESPONDENTS - 1);
  });

  it("releases free text once the batch is large enough", async () => {
    const submissions = Array.from({ length: FREE_TEXT_MIN_RESPONDENTS }, (_, index) => ({
      evaluation_submission_id: BigInt(index + 1),
      evaluation_answer: [answer({ evaluation_question_id: BigInt(2), answer_text: `comment ${index}` })],
    }));

    const summary = await buildFakeDb({ submissions }).readEvaluationSummary(PLAN_ID, "EVALUATION", null);
    const comments = summary!.questions[1];

    expect(comments.textAnswersWithheld).toBe(false);
    expect(comments.textAnswers).toHaveLength(FREE_TEXT_MIN_RESPONDENTS);
  });

  it("never returns anything that maps an answer back to a person", async () => {
    // The anonymity promise is kept by the shape of the projection, not by a screen remembering
    // not to render a field. If an id ever leaks into this payload, this test fails.
    const summary = await buildFakeDb({
      submissions: [
        {
          evaluation_submission_id: BigInt(1),
          evaluation_answer: [answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(11) })],
        },
      ],
    }).readEvaluationSummary(PLAN_ID, "EVALUATION", null);

    const serialised = JSON.stringify(summary);
    for (const forbidden of ["submissionId", "evaluation_submission_id", "enrollmentId", "enrollment_id", "employee"]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("refuses a plan outside an HRD_FACTORY user's company", async () => {
    const repository = buildFakeDb({ companyId: BigInt(2) });
    await expect(repository.readEvaluationSummary(PLAN_ID, "EVALUATION", "3")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns null when the course has no form for that timing", async () => {
    const repository = buildFakeDb({});
    expect(await repository.readEvaluationSummary(PLAN_ID, "EVALUATION_30DAY", null)).toBeNull();
  });
});

describe("readAssessmentReviewForEmployee", () => {
  const ASSESSMENT_ID = BigInt(501);
  const OWNER = { employeeId: "101", employeeUserId: "USER-101" };

  const buildReviewDb = (opts: { publicationStatus?: string } = {}) => {
    const db = {
      training_enrollment: {
        findUnique: async () => ({
          enrollment_id: BigInt(1),
          plan_id: BigInt(77),
          approval_status: "APPROVED",
          employee_user_id: OWNER.employeeUserId,
          employee: { employee_id: BigInt(OWNER.employeeId) },
          training_plan: {
            start_datetime: new Date(),
            end_datetime: new Date(),
            training_plan_oap: {
              company_id: BigInt(2),
              course: {
                pre_assessment_id: ASSESSMENT_ID,
                pre_test_link: null,
                post_assessment_id: null,
                post_test_link: null,
                evaluation_form_id: null,
                evaluation_form_after_30day_id: null,
              },
            },
          },
        }),
      },
      assessment_submission: {
        findFirst: async ({ where }: { where: { publication_status: string } }) => {
          if ((opts.publicationStatus ?? "PUBLISHED") !== where.publication_status) return null;
          return {
            submission_id: BigInt(9),
            attempt_no: 2,
            submitted_at: new Date(0),
            score: new Prisma.Decimal(50),
            pass_status: "FAIL",
            assessment: {
              passing_score_percent: new Prisma.Decimal(80),
              assessment_question: [
                { question_id: BigInt(1), question_order: 1, question_text: "ข้อที่ตอบถูก", question_score: new Prisma.Decimal(5) },
                { question_id: BigInt(2), question_order: 2, question_text: "ข้อที่ตอบผิด", question_score: new Prisma.Decimal(5) },
              ],
            },
            assessment_answer: [
              { question_id: BigInt(1), score_awarded: new Prisma.Decimal(5), review_comment: null },
              { question_id: BigInt(2), score_awarded: new Prisma.Decimal(0), review_comment: "ทบทวนบทที่ 3" },
            ],
          };
        },
      },
    };
    return createTrainingFormsRepository(db as unknown as Parameters<typeof createTrainingFormsRepository>[0]);
  };

  it("returns only the questions below full marks, never the answer key", async () => {
    // Attempts are repeatable, so handing back which choice was correct turns a retake into a
    // memory test. Only the score and the question text may travel.
    const review = await buildReviewDb().readAssessmentReviewForEmployee(
      "1",
      "PRE_TEST",
      OWNER.employeeId,
      OWNER.employeeUserId,
    );

    expect(review!.missedQuestions).toHaveLength(1);
    expect(review!.missedQuestions[0].questionText).toBe("ข้อที่ตอบผิด");
    expect(review!.missedQuestions[0].scoreAwarded).toBe(0);
    expect(review!.missedQuestions[0].questionScore).toBe(5);
    expect(review!.missedQuestions[0].reviewComment).toBe("ทบทวนบทที่ 3");
    expect(review!.totalAwarded).toBe(5);
    expect(review!.totalPossible).toBe(10);
    expect(review!.passingScorePercent).toBe(80);

    const serialised = JSON.stringify(review);
    for (const forbidden of ["isCorrect", "is_correct", "choice", "correct"]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("shows nothing until HRD has released the result", async () => {
    const review = await buildReviewDb({ publicationStatus: "UNPUBLISHED" }).readAssessmentReviewForEmployee(
      "1",
      "PRE_TEST",
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(review).toBeNull();
  });

  it("refuses to show one employee's paper to another", async () => {
    await expect(
      buildReviewDb().readAssessmentReviewForEmployee("1", "PRE_TEST", "999", "USER-999"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("readEvaluationSummary - grid questions", () => {
  /**
   * A grid answer is a (row, column) pair. Counting by column alone merges every row together and
   * reports "people who picked this column somewhere in the grid", which is never the question
   * being asked - so the summary reports a grid per row instead.
   */
  const GRID_QUESTION = [{
    evaluation_question_id: BigInt(1),
    question_order: 1,
    question_text: "ให้คะแนนแต่ละหัวข้อ",
    question_type: "MULTIPLE_CHOICE_GRID",
    section_name: null,
    evaluation_option: [
      { evaluation_option_id: BigInt(31), option_text: "เนื้อหา", axis: "ROW" },
      { evaluation_option_id: BigInt(32), option_text: "วิทยากร", axis: "ROW" },
      { evaluation_option_id: BigInt(41), option_text: "ดี", axis: "COLUMN" },
      { evaluation_option_id: BigInt(42), option_text: "พอใช้", axis: "COLUMN" },
    ],
  }];

  const cell = (rowId: bigint, columnId: bigint) =>
    answer({ evaluation_question_id: BigInt(1), evaluation_option_id: columnId, row_option_id: rowId });

  const summarise = () => buildFakeDb({
    enrolledCount: 4,
    questions: GRID_QUESTION,
    submissions: [
      // Person A: content = good, instructor = fair
      { evaluation_submission_id: BigInt(1), evaluation_answer: [cell(BigInt(31), BigInt(41)), cell(BigInt(32), BigInt(42))] },
      // Person B: content = good, instructor = good
      { evaluation_submission_id: BigInt(2), evaluation_answer: [cell(BigInt(31), BigInt(41)), cell(BigInt(32), BigInt(41))] },
    ],
  }).readEvaluationSummary(PLAN_ID, "EVALUATION", null);

  it("reports counts per row, not merged across the whole grid", async () => {
    const summary = await summarise();
    const [content, instructor] = summary!.questions[0].gridRows;

    // Column "ดี" was picked three times overall - twice on content, once on the instructor.
    // A column-only count would report 3 for both rows; per-row is 2 and 1.
    expect(content.rowText).toBe("เนื้อหา");
    expect(content.cells.map((c) => [c.columnText, c.count])).toEqual([["ดี", 2], ["พอใช้", 0]]);
    expect(instructor.cells.map((c) => [c.columnText, c.count])).toEqual([["ดี", 1], ["พอใช้", 1]]);
  });

  it("takes each row's percentages against the people who answered that row", async () => {
    const summary = await summarise();
    const [content] = summary!.questions[0].gridRows;
    expect(content.answeredBy).toBe(2);
    expect(content.cells.map((c) => c.percent)).toEqual([100, 0]);
  });

  it("leaves options empty for a grid, since rows and columns are not options", async () => {
    // Otherwise the rows and the columns would come back as one flat option list and the screen
    // would draw a bar chart of them side by side.
    const summary = await summarise();
    expect(summary!.questions[0].options).toEqual([]);
  });

  it("leaves gridRows empty for an ordinary question", async () => {
    const summary = await buildFakeDb({
      submissions: [{
        evaluation_submission_id: BigInt(1),
        evaluation_answer: [answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(11) })],
      }],
    }).readEvaluationSummary(PLAN_ID, "EVALUATION", null);
    expect(summary!.questions[0].gridRows).toEqual([]);
    expect(summary!.questions[0].options).toHaveLength(3);
  });
});
