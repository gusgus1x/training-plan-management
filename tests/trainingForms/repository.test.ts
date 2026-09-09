import { describe, expect, it } from "vitest";
import { Prisma } from "../../app/generated/prisma/client";
import { createTrainingFormsRepository } from "../../app/lib/trainingForms/repository";

/**
 * Repository-level tests against a hand-built in-memory fake of the Prisma client, not the live
 * database - this module writes real submissions/answers/results, and this session's rule is to
 * never create data in the real database without asking each time. A fake keeps that promise while
 * still exercising the real scoring/authorization/availability logic in repository.ts.
 */

// repository.ts always reads the real wall clock (no injectable clock), so every fixture date is
// anchored to the moment the test runs rather than a fixed calendar date - a hardcoded future date
// would start failing "NOT_YET" as soon as the real clock caught up to it.
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const START = new Date(NOW - DAY_MS).toISOString();
const END = new Date(NOW - 12 * 60 * 60 * 1000).toISOString();
const FUTURE_START = new Date(NOW + DAY_MS).toISOString();
const FUTURE_END = new Date(NOW + 2 * DAY_MS).toISOString();

const OWNER = { employeeId: "101", employeeUserId: "USER-101" };

type Choice = {
  choice_id: bigint;
  choice_order: number;
  choice_text: string;
  is_correct: boolean;
  /** Grid questions only - see app/lib/formGrids.ts. */
  axis?: "ROW" | "COLUMN" | null;
  option_score?: Prisma.Decimal;
  correct_columns?: string | null;
};
type Question = {
  question_id: bigint;
  question_order: number;
  question_text: string;
  question_type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "TRUE_FALSE" | "SECTION_BREAK" | "TEXT_BLOCK" | "MULTIPLE_CHOICE_GRID" | "CHECKBOX_GRID";
  question_score: Prisma.Decimal;
  is_required: boolean;
  assessment_choice: Choice[];
};

const buildFakeDb = (opts: {
  assessmentId?: bigint;
  passingScorePercent?: number;
  questions?: Question[];
  start?: string;
  end?: string;
  stageClosedAt?: string | null;
  approvalStatus?: string;
  courseFormIds?: { pre?: bigint | null; post?: bigint | null; evaluation?: bigint | null; evaluation30?: bigint | null };
} = {}) => {
  const assessmentId = opts.assessmentId ?? BigInt(501);
  const questions =
    opts.questions ??
    [
      {
        question_id: BigInt(1),
        question_order: 1,
        question_text: "1 + 1 = ?",
        question_type: "SINGLE_CHOICE" as const,
        question_score: new Prisma.Decimal(100),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(11), choice_order: 1, choice_text: "2", is_correct: true },
          { choice_id: BigInt(12), choice_order: 2, choice_text: "3", is_correct: false },
        ],
      },
    ];
  const courseFormIds = { pre: assessmentId, post: assessmentId, evaluation: null, evaluation30: null, ...opts.courseFormIds };

  const submissions: Array<{
    submission_id: bigint;
    enrollment_id: bigint;
    assessment_id: bigint;
    assessment_stage: string;
    attempt_no: number;
    submitted_at: Date | null;
    score: Prisma.Decimal | null;
    pass_status: string;
    status: string;
    grading_status: string;
  }> = [];
  const answers: Array<{
    answer_id: bigint;
    submission_id: bigint;
    question_id: bigint;
    choice_id: bigint | null;
    answer_text: string | null;
    is_correct: boolean | null;
    score_awarded: Prisma.Decimal | null;
    review_status: string;
    reviewed_by?: bigint;
    reviewed_at?: Date;
    review_comment?: string | null;
  }> = [];
  const evaluationAnswers: Array<Record<string, unknown>> = [];
  let nextSubmissionId = BigInt(9001);
  let nextAnswerId = BigInt(9001);
  let trainingResult: { pre_score?: Prisma.Decimal; post_score?: Prisma.Decimal; official_pre_submission_id?: bigint; official_post_submission_id?: bigint } | null = null;

  const enrollment = {
    enrollment_id: BigInt(1),
    plan_id: BigInt(1),
    employee_user_id: OWNER.employeeUserId,
    approval_status: opts.approvalStatus ?? "APPROVED",
    employee: { employee_id: BigInt(OWNER.employeeId) },
    training_plan: {
      start_datetime: new Date(opts.start ?? START),
      end_datetime: new Date(opts.end ?? END),
      training_plan_oap: {
        company_id: null,
        course: {
          pre_assessment_id: courseFormIds.pre,
          post_assessment_id: courseFormIds.post,
          evaluation_form_id: courseFormIds.evaluation,
          evaluation_form_after_30day_id: courseFormIds.evaluation30,
        },
      },
    },
  };

  const stageSetting = opts.stageClosedAt ? { close_at: new Date(opts.stageClosedAt) } : null;
  const closableSettingRows: Array<{ assessment_stage: string; close_at: Date }> = opts.stageClosedAt
    ? [{ assessment_stage: "PRE_TEST", close_at: new Date(opts.stageClosedAt) }]
    : [];

  const tx = {
    assessment_submission: {
      count: async ({ where }: any) =>
        submissions.filter(
          (s) => s.enrollment_id === where.enrollment_id && s.assessment_id === where.assessment_id && s.assessment_stage === where.assessment_stage,
        ).length,
      create: async ({ data }: any) => {
        const row = { submission_id: nextSubmissionId++, ...data };
        submissions.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = submissions.find((s) => s.submission_id === where.submission_id)!;
        Object.assign(row, data);
        return row;
      },
      findFirst: async ({ where }: any) => {
        const candidates = submissions
          .filter((s) => s.enrollment_id === where.enrollment_id && s.assessment_stage === where.assessment_stage && s.score !== null)
          .sort((a, b) => (b.score! as any).minus(a.score! as any).toNumber() || (b.submitted_at?.getTime() ?? 0) - (a.submitted_at?.getTime() ?? 0));
        return candidates[0] ?? null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const row = submissions.find((s) => s.submission_id === where.submission_id);
        if (!row) throw new Error("not found");
        return {
          ...row,
          assessment_answer: answers.filter((a) => a.submission_id === row.submission_id),
          assessment: {
            passing_score_percent: new Prisma.Decimal(opts.passingScorePercent ?? 50),
            assessment_question: questions.map((q) => ({ question_id: q.question_id, question_score: q.question_score })),
          },
          training_enrollment: { training_plan: { training_plan_oap: { company_id: enrollment.training_plan.training_plan_oap.company_id } } },
        };
      },
    },
    assessment_answer: {
      createMany: async ({ data }: any) => {
        for (const row of data) answers.push({ answer_id: nextAnswerId++, ...row });
        return { count: data.length };
      },
      update: async ({ where, data }: any) => {
        const row = answers.find((a) => a.answer_id === where.answer_id)!;
        Object.assign(row, data);
        return row;
      },
    },
    evaluation_submission: {
      create: async ({ data }: any) => ({ evaluation_submission_id: BigInt(7001), ...data }),
    },
    evaluation_answer: {
      createMany: async ({ data }: any) => {
        // Captured rather than discarded so a test can assert what an evaluation actually stores -
        // in particular that a grid answer is written at all, and that it carries no score.
        for (const row of data) evaluationAnswers.push(row);
        return { count: data.length };
      },
    },
    training_result: {
      upsert: async ({ create, update }: any) => {
        trainingResult = { ...(trainingResult ?? {}), ...update, ...(trainingResult ? {} : create) };
        return trainingResult;
      },
    },
  };

  const db = {
    training_enrollment: {
      findUnique: async () => enrollment,
    },
    training_plan: {
      findUniqueOrThrow: async () => ({
        start_datetime: enrollment.training_plan.start_datetime,
        end_datetime: enrollment.training_plan.end_datetime,
        training_plan_oap: enrollment.training_plan.training_plan_oap,
      }),
    },
    training_plan_assessment_setting: {
      findUnique: async () => stageSetting,
      findMany: async () => closableSettingRows,
      upsert: async ({ where, create, update }: any) => {
        const existing = closableSettingRows.find((r) => r.assessment_stage === where.plan_id_assessment_stage.assessment_stage);
        if (existing) {
          Object.assign(existing, update);
        } else {
          closableSettingRows.push({ assessment_stage: create.assessment_stage, close_at: create.close_at });
        }
      },
      deleteMany: async ({ where }: any) => {
        const index = closableSettingRows.findIndex((r) => r.assessment_stage === where.assessment_stage);
        if (index >= 0) closableSettingRows.splice(index, 1);
      },
    },
    assessment: {
      findUniqueOrThrow: async () => ({
        assessment_id: assessmentId,
        instructions: null,
        time_limit_minutes: null,
        passing_score_percent: new Prisma.Decimal(opts.passingScorePercent ?? 50),
        assessment_series: { series_name: "Sample Assessment" },
        assessment_question: questions,
      }),
    },
    assessment_submission: {
      findMany: async () =>
        submissions.map((s) => ({
          submission_id: s.submission_id,
          attempt_no: s.attempt_no,
          submitted_at: s.submitted_at,
          score: s.score,
          pass_status: s.pass_status,
          status: s.status,
          grading_status: s.grading_status,
        })),
      findUniqueOrThrow: tx.assessment_submission.findUniqueOrThrow,
    },
    evaluation_form: {
      findUniqueOrThrow: async () => ({
        evaluation_form_id: courseFormIds.evaluation ?? BigInt(601),
        form_name: "Sample Evaluation",
        description: null,
        is_anonymous: false,
        evaluation_question: [],
      }),
    },
    evaluation_submission: {
      findUnique: async () => null,
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  } as any;

  // `submissions` is handed back so a regrade test can read the score that was written -
  // gradeSubmission itself only answers { graded: true }.
  return { db, submissions, evaluationAnswers };
};

describe("readAssessmentForEmployee - no answer-key leak", () => {
  it("never includes isCorrect or optionScore on any choice sent to the employee", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    const result = await repo.readAssessmentForEmployee("1", "PRE_TEST", OWNER.employeeId, OWNER.employeeUserId);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("optionScore");
    expect(result.questions[0].choices[0]).toEqual({ choiceId: "11", choiceOrder: 1, choiceText: "2" });
  });
});

describe("enrollment ownership", () => {
  it("refuses a caller who owns neither key on the enrollment", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    await expect(
      repo.readAssessmentForEmployee("1", "PRE_TEST", "999", "USER-999"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("refuses access to a registration that was never approved", async () => {
    const { db } = buildFakeDb({ approvalStatus: "PENDING" });
    const repo = createTrainingFormsRepository(db);
    await expect(
      repo.readAssessmentForEmployee("1", "PRE_TEST", OWNER.employeeId, OWNER.employeeUserId),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("stage availability enforced server-side", () => {
  it("refuses to submit before the plan starts, even with a well-formed answer", async () => {
    const { db } = buildFakeDb({ start: FUTURE_START, end: FUTURE_END });
    const repo = createTrainingFormsRepository(db);
    await expect(
      repo.submitAssessment("1", "PRE_TEST", { answers: [{ questionId: "1", choiceIds: ["11"], text: null }] }, OWNER.employeeId, OWNER.employeeUserId),
    ).rejects.toMatchObject({ code: "STAGE_NOT_OPEN", status: 403 });
  });

  it("refuses to submit once HRD has closed the stage, even though the plan already started", async () => {
    const { db } = buildFakeDb({ stageClosedAt: new Date(NOW - 60 * 60 * 1000).toISOString() });
    const repo = createTrainingFormsRepository(db);
    await expect(
      repo.submitAssessment("1", "PRE_TEST", { answers: [{ questionId: "1", choiceIds: ["11"], text: null }] }, OWNER.employeeId, OWNER.employeeUserId),
    ).rejects.toMatchObject({ code: "STAGE_CLOSED", status: 409 });
  });
});

describe("submitAssessment - autograding", () => {
  it("awards full credit for a correct SINGLE_CHOICE answer and writes the official result immediately", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    const result = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "1", choiceIds: ["11"], text: null }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(result.score).toBe(100);
    expect(result.passStatus).toBe("PASS");
    expect(result.gradingStatus).toBe("REVIEWED");
    expect(result.status).toBe("GRADED");
  });

  it("gives zero credit for a wrong answer and fails against the passing score", async () => {
    const { db } = buildFakeDb({ passingScorePercent: 50 });
    const repo = createTrainingFormsRepository(db);
    const result = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "1", choiceIds: ["12"], text: null }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(result.score).toBe(0);
    expect(result.passStatus).toBe("FAIL");
  });

  it("counts an omitted question as 0 in the total rather than dropping it from the denominator", async () => {
    // Two 100-point questions; the client only answers one (correctly). If the omitted question
    // were excluded from totalPossible instead of counted as wrong, this would score 100% instead
    // of the correct 50%.
    const questions: Question[] = [
      {
        question_id: BigInt(1),
        question_order: 1,
        question_text: "1 + 1 = ?",
        question_type: "SINGLE_CHOICE",
        question_score: new Prisma.Decimal(100),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(11), choice_order: 1, choice_text: "2", is_correct: true },
          { choice_id: BigInt(12), choice_order: 2, choice_text: "3", is_correct: false },
        ],
      },
      {
        question_id: BigInt(5),
        question_order: 2,
        question_text: "2 + 2 = ?",
        question_type: "SINGLE_CHOICE",
        question_score: new Prisma.Decimal(100),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(51), choice_order: 1, choice_text: "4", is_correct: true },
          { choice_id: BigInt(52), choice_order: 2, choice_text: "5", is_correct: false },
        ],
      },
    ];
    const { db } = buildFakeDb({ questions });
    const repo = createTrainingFormsRepository(db);
    const result = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "1", choiceIds: ["11"], text: null }] }, // question 5 never sent
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(result.score).toBe(50);
  });

  it("ignores section breaks and text blocks entirely when scoring", async () => {
    // Two real questions worth 10 each, one answered right and one wrong, so the correct answer is
    // 50%. A section break and a text block sit between them, and they deliberately carry a
    // non-zero question_score here.
    //
    // The trap: the choice branch treats anything that is not SHORT_ANSWER as a choice question, so
    // a block row compares an empty correct set against an empty submitted set, evaluates as
    // CORRECT, and awards its full question_score. Without the isFormBlockType guard this scores
    // 30/40 = 75% instead of 10/20 = 50% - the blocks would both inflate the denominator and hand
    // out free marks. Zero-scored blocks would make this test pass either way, which is why the
    // fixture scores them.
    const questions: Question[] = [
      {
        question_id: BigInt(1),
        question_order: 1,
        question_text: "1 + 1 = ?",
        question_type: "SINGLE_CHOICE",
        question_score: new Prisma.Decimal(10),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(11), choice_order: 1, choice_text: "2", is_correct: true },
          { choice_id: BigInt(12), choice_order: 2, choice_text: "3", is_correct: false },
        ],
      },
      {
        question_id: BigInt(2),
        question_order: 2,
        question_text: "Part two",
        question_type: "SECTION_BREAK",
        question_score: new Prisma.Decimal(10),
        is_required: false,
        assessment_choice: [],
      },
      {
        question_id: BigInt(3),
        question_order: 3,
        question_text: "Read this first",
        question_type: "TEXT_BLOCK",
        question_score: new Prisma.Decimal(10),
        is_required: false,
        assessment_choice: [],
      },
      {
        question_id: BigInt(4),
        question_order: 4,
        question_text: "2 + 2 = ?",
        question_type: "SINGLE_CHOICE",
        question_score: new Prisma.Decimal(10),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(41), choice_order: 1, choice_text: "4", is_correct: true },
          { choice_id: BigInt(42), choice_order: 2, choice_text: "5", is_correct: false },
        ],
      },
    ];
    const { db } = buildFakeDb({ questions });
    const repo = createTrainingFormsRepository(db);
    const result = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [
        { questionId: "1", choiceIds: ["11"], text: null }, // correct
        { questionId: "4", choiceIds: ["42"], text: null }, // wrong
      ] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(result.score).toBe(50);
  });

  it("gives zero credit for a MULTIPLE_CHOICE answer missing one of the correct options", async () => {
    const questions: Question[] = [
      {
        question_id: BigInt(2),
        question_order: 1,
        question_text: "Pick both even numbers",
        question_type: "MULTIPLE_CHOICE",
        question_score: new Prisma.Decimal(100),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(21), choice_order: 1, choice_text: "2", is_correct: true },
          { choice_id: BigInt(22), choice_order: 2, choice_text: "4", is_correct: true },
          { choice_id: BigInt(23), choice_order: 3, choice_text: "5", is_correct: false },
        ],
      },
    ];
    const { db } = buildFakeDb({ questions });
    const repo = createTrainingFormsRepository(db);
    const partial = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "2", choiceIds: ["21"], text: null }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(partial.score).toBe(0);

    const full = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "2", choiceIds: ["21", "22"], text: null }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(full.score).toBe(100);
  });

  it("leaves a SHORT_ANSWER submission pending review with no score until HRD grades it", async () => {
    const questions: Question[] = [
      {
        question_id: BigInt(3),
        question_order: 1,
        question_text: "Explain the safety procedure",
        question_type: "SHORT_ANSWER",
        question_score: new Prisma.Decimal(100),
        is_required: true,
        assessment_choice: [],
      },
    ];
    const { db } = buildFakeDb({ questions });
    const repo = createTrainingFormsRepository(db);
    const result = await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "3", choiceIds: [], text: "Wear the harness at all times." }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(result.score).toBeNull();
    expect(result.passStatus).toBe("PENDING");
    expect(result.gradingStatus).toBe("PENDING_REVIEW");
    expect(result.status).toBe("SUBMITTED");
  });

  it("lets an unlimited number of attempts through, numbering each one", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    const first = await repo.submitAssessment("1", "PRE_TEST", { answers: [{ questionId: "1", choiceIds: ["11"], text: null }] }, OWNER.employeeId, OWNER.employeeUserId);
    const second = await repo.submitAssessment("1", "PRE_TEST", { answers: [{ questionId: "1", choiceIds: ["12"], text: null }] }, OWNER.employeeId, OWNER.employeeUserId);
    expect(first.attemptNo).toBe(1);
    expect(second.attemptNo).toBe(2);
  });
});

describe("gradeSubmission", () => {
  it("refuses to save while any short-answer question is still ungraded", async () => {
    const questions: Question[] = [
      { question_id: BigInt(3), question_order: 1, question_text: "Q1", question_type: "SHORT_ANSWER", question_score: new Prisma.Decimal(50), is_required: true, assessment_choice: [] },
      { question_id: BigInt(4), question_order: 2, question_text: "Q2", question_type: "SHORT_ANSWER", question_score: new Prisma.Decimal(50), is_required: true, assessment_choice: [] },
    ];
    const { db } = buildFakeDb({ questions });
    const repo = createTrainingFormsRepository(db);
    await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "3", choiceIds: [], text: "a" }, { questionId: "4", choiceIds: [], text: "b" }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    await expect(repo.gradeSubmission("9001", { answers: [{ answerId: "9001", scoreAwarded: 50, reviewComment: null }] }, "1", null)).rejects.toMatchObject({
      code: "GRADING_INCOMPLETE",
      status: 400,
    });
  });

  it("finalizes the submission once every short-answer question is graded", async () => {
    const questions: Question[] = [
      { question_id: BigInt(3), question_order: 1, question_text: "Q1", question_type: "SHORT_ANSWER", question_score: new Prisma.Decimal(100), is_required: true, assessment_choice: [] },
    ];
    const { db } = buildFakeDb({ questions, passingScorePercent: 60 });
    const repo = createTrainingFormsRepository(db);
    await repo.submitAssessment("1", "PRE_TEST", { answers: [{ questionId: "3", choiceIds: [], text: "answer" }] }, OWNER.employeeId, OWNER.employeeUserId);
    const graded = await repo.gradeSubmission("9001", { answers: [{ answerId: "9001", scoreAwarded: 80, reviewComment: "Good" }] }, "1", null);
    expect(graded.graded).toBe(true);
  });

  // Both of these assert the regraded percentage matches what the same answers scored at submit
  // time. The denominator used to be summed per answer row, which a multi-select question inflates
  // (one row per tick) and an unanswered question shrinks (no rows at all).
  it("counts a multi-select question once in the total, not once per selected choice", async () => {
    const questions: Question[] = [
      { question_id: BigInt(3), question_order: 1, question_text: "Explain", question_type: "SHORT_ANSWER", question_score: new Prisma.Decimal(50), is_required: true, assessment_choice: [] },
      {
        question_id: BigInt(4),
        question_order: 2,
        question_text: "Pick both even numbers",
        question_type: "MULTIPLE_CHOICE",
        question_score: new Prisma.Decimal(50),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(41), choice_order: 1, choice_text: "2", is_correct: true },
          { choice_id: BigInt(42), choice_order: 2, choice_text: "4", is_correct: true },
          { choice_id: BigInt(43), choice_order: 3, choice_text: "5", is_correct: false },
        ],
      },
    ];
    const { db, submissions } = buildFakeDb({ questions, passingScorePercent: 60 });
    const repo = createTrainingFormsRepository(db);
    await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "3", choiceIds: [], text: "an answer" }, { questionId: "4", choiceIds: ["41", "42"], text: null }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );

    // Short answer graded full marks; the multi-select was already right, so this is 100/100.
    await repo.gradeSubmission("9001", { answers: [{ answerId: "9001", scoreAwarded: 50, reviewComment: null }] }, "1", null);

    const submission = submissions.find((s) => s.submission_id === BigInt(9001))!;
    expect(Number(submission.score)).toBe(100);
    expect(submission.pass_status).toBe("PASS");
  });

  it("keeps an unanswered question in the total when regrading", async () => {
    const questions: Question[] = [
      { question_id: BigInt(3), question_order: 1, question_text: "Explain", question_type: "SHORT_ANSWER", question_score: new Prisma.Decimal(50), is_required: true, assessment_choice: [] },
      {
        question_id: BigInt(5),
        question_order: 2,
        question_text: "2 + 2 = ?",
        question_type: "SINGLE_CHOICE",
        question_score: new Prisma.Decimal(50),
        is_required: true,
        assessment_choice: [
          { choice_id: BigInt(51), choice_order: 1, choice_text: "4", is_correct: true },
          { choice_id: BigInt(52), choice_order: 2, choice_text: "5", is_correct: false },
        ],
      },
    ];
    const { db, submissions } = buildFakeDb({ questions, passingScorePercent: 60 });
    const repo = createTrainingFormsRepository(db);
    await repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "3", choiceIds: [], text: "an answer" }] }, // question 5 never answered
      OWNER.employeeId,
      OWNER.employeeUserId,
    );

    await repo.gradeSubmission("9001", { answers: [{ answerId: "9001", scoreAwarded: 50, reviewComment: null }] }, "1", null);

    // 50 of a possible 100 - the skipped question still counts against the employee.
    const submission = submissions.find((s) => s.submission_id === BigInt(9001))!;
    expect(Number(submission.score)).toBe(50);
    expect(submission.pass_status).toBe("FAIL");
  });
});

describe("submitEvaluation", () => {
  it("refuses a second submission of the same evaluation form", async () => {
    const { db } = buildFakeDb({ courseFormIds: { evaluation: BigInt(601) } });
    db.evaluation_submission.findUnique = async () => ({ evaluation_submission_id: BigInt(1) });
    const repo = createTrainingFormsRepository(db);
    await expect(
      repo.submitEvaluation("1", "EVALUATION", { answers: [] }, OWNER.employeeId, OWNER.employeeUserId),
    ).rejects.toMatchObject({ code: "ALREADY_SUBMITTED", status: 409 });
  });
});

describe("the assigned supervisor's reach", () => {
  // The supervisor is asked what changed in the person 30 days on, and nothing else. Everything
  // below is about keeping that boundary: an assignment must not become a general key to the
  // attendee's record.
  const BOSS = "USER-BOSS";
  const assignedTo = (reviewerUserId: string, formIds: Parameters<typeof buildFakeDb>[0] = {}) => {
    const built = buildFakeDb(formIds);
    const original = built.db.training_enrollment.findUnique;
    built.db.training_enrollment.findUnique = async (args: unknown) => ({
      ...(await original(args)),
      training_evaluation_reviewer: { reviewer_user_id: reviewerUserId },
    });
    // Opening the form stamps opened_at for the supervisor. The stamp itself is covered by the
    // route tests; here it only has to not blow up.
    built.db.training_evaluation_reviewer = { updateMany: async () => ({ count: 1 }) };
    // The shared fake answers with one fixed form whatever is asked for. Echoing the requested id
    // is what makes "which stage did it resolve" assertable at all.
    built.db.evaluation_form.findUniqueOrThrow = async ({ where }: any) => ({
      evaluation_form_id: where.evaluation_form_id,
      form_name: "Sample Evaluation",
      description: null,
      is_anonymous: false,
      evaluation_question: [],
    });
    return built.db;
  };

  // The follow-up opens FOLLOW_UP_OPENS_AFTER_DAYS after the course ends, so a course that ended
  // yesterday would fail on availability long before authorization is the thing under test.
  const ENDED_LONG_AGO = {
    start: new Date(NOW - 40 * DAY_MS).toISOString(),
    end: new Date(NOW - 39 * DAY_MS).toISOString(),
  };

  it("lets the assigned supervisor open the 30-day follow-up about somebody else", async () => {
    const db = assignedTo(BOSS, { ...ENDED_LONG_AGO, courseFormIds: { evaluation30: BigInt(602) } });
    const repo = createTrainingFormsRepository(db);

    const evaluation = await repo.readEvaluationForEmployee("1", "EVALUATION_30DAY", null, BOSS);

    expect(evaluation.evaluationFormId).toBe("602");
  });

  it("refuses the same supervisor the after-training evaluation, which is the attendee's own", async () => {
    const db = assignedTo(BOSS, { courseFormIds: { evaluation: BigInt(601), evaluation30: BigInt(602) } });
    const repo = createTrainingFormsRepository(db);

    await expect(repo.readEvaluationForEmployee("1", "EVALUATION", null, BOSS)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("refuses a supervisor who was never assigned to this attendee", async () => {
    const db = assignedTo(BOSS, { ...ENDED_LONG_AGO, courseFormIds: { evaluation30: BigInt(602) } });
    const repo = createTrainingFormsRepository(db);

    await expect(
      repo.readEvaluationForEmployee("1", "EVALUATION_30DAY", null, "USER-SOMEONE-ELSE"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("never lets an assignment open the attendee's exam", async () => {
    const db = assignedTo(BOSS);
    const repo = createTrainingFormsRepository(db);

    await expect(repo.readAssessmentForEmployee("1", "PRE_TEST", null, BOSS)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("listPlanStageSettings", () => {
  it("reports FORM for a stage the course has a real assessment on", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    const settings = await repo.listPlanStageSettings("1", null);
    const preTest = settings.find((s) => s.stage === "PRE_TEST")!;
    expect(preTest.mode).toBe("FORM");
  });

  it("reports NONE for a stage the course has neither a form nor a link for", async () => {
    const { db } = buildFakeDb({ courseFormIds: { pre: null, post: null } });
    const repo = createTrainingFormsRepository(db);
    const settings = await repo.listPlanStageSettings("1", null);
    expect(settings.every((s) => s.mode === "NONE")).toBe(true);
  });

  it("refuses a factory HRD reading a plan owned by a different company", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    await expect(repo.listPlanStageSettings("1", "999")).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("setStageClosed", () => {
  it("closing PRE_TEST does not touch POST_TEST", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    await repo.setStageClosed("1", { stage: "PRE_TEST", closed: true }, "1", null);
    const settings = await repo.listPlanStageSettings("1", null);
    expect(settings.find((s) => s.stage === "PRE_TEST")!.closedAt).not.toBeNull();
    expect(settings.find((s) => s.stage === "POST_TEST")!.closedAt).toBeNull();
  });

  it("reopening removes the close switch entirely, not just its timestamp", async () => {
    const { db } = buildFakeDb();
    const repo = createTrainingFormsRepository(db);
    await repo.setStageClosed("1", { stage: "PRE_TEST", closed: true }, "1", null);
    await repo.setStageClosed("1", { stage: "PRE_TEST", closed: false }, "1", null);
    const settings = await repo.listPlanStageSettings("1", null);
    expect(settings.find((s) => s.stage === "PRE_TEST")!.closedAt).toBeNull();
  });

  it("refuses to close a stage the course has no form for", async () => {
    const { db } = buildFakeDb({ courseFormIds: { pre: null } });
    const repo = createTrainingFormsRepository(db);
    await expect(repo.setStageClosed("1", { stage: "PRE_TEST", closed: true }, "1", null)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });
});

describe("submitAssessment - grid questions", () => {
  /**
   * One grid worth 4 points: four rows at 1 point each, three columns. Row N's correct column is
   * ((N-1) % 3) + 1, so rows 1..4 want columns 1, 2, 3, 1.
   *
   * Four rows rather than three so every partial score lands on a whole percentage - the repository
   * returns the raw percentage, it does not round.
   *
   * Google Forms scores a grid per row, which makes this the one place in the system where partial
   * credit within a single question is intended rather than a bug.
   */
  const COLUMN_IDS = ["21", "22", "23"];
  const gridQuestion = (questionType: "MULTIPLE_CHOICE_GRID" | "CHECKBOX_GRID"): Question[] => [{
    question_id: BigInt(1),
    question_order: 1,
    question_text: "Match each item",
    question_type: questionType,
    // Must equal the sum of the row points; the writer keeps the two in sync.
    question_score: new Prisma.Decimal(4),
    is_required: true,
    assessment_choice: [
      ...[1, 2, 3, 4].map((n) => ({
        choice_id: BigInt(10 + n),
        choice_order: n,
        choice_text: `Row ${n}`,
        is_correct: false,
        axis: "ROW" as const,
        option_score: new Prisma.Decimal(1),
        correct_columns: String(((n - 1) % 3) + 1),
      })),
      ...COLUMN_IDS.map((id, index) => ({
        choice_id: BigInt(id),
        choice_order: 5 + index,
        choice_text: `Col ${index + 1}`,
        is_correct: false,
        axis: "COLUMN" as const,
        option_score: new Prisma.Decimal(0),
        correct_columns: null,
      })),
    ],
  }];

  /** The fully correct answer: row N picks the column its key names. */
  const allCorrect = [1, 2, 3, 4].map((n) => ({
    rowId: String(10 + n),
    columnIds: [COLUMN_IDS[(n - 1) % 3]],
  }));

  const submitGrid = async (
    questionType: "MULTIPLE_CHOICE_GRID" | "CHECKBOX_GRID",
    grid: Array<{ rowId: string; columnIds: string[] }>,
  ) => {
    const { db } = buildFakeDb({ questions: gridQuestion(questionType) });
    const repo = createTrainingFormsRepository(db);
    return repo.submitAssessment(
      "1",
      "PRE_TEST",
      { answers: [{ questionId: "1", choiceIds: [], text: null, grid }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
  };

  it("awards every row when all four are right", async () => {
    expect((await submitGrid("MULTIPLE_CHOICE_GRID", allCorrect)).score).toBe(100);
  });

  it("scores per row, so three of four rows right is 75%", async () => {
    const grid = [...allCorrect.slice(0, 3), { rowId: "14", columnIds: ["22"] }];
    expect((await submitGrid("MULTIPLE_CHOICE_GRID", grid)).score).toBe(75);
  });

  it("counts an unanswered row as wrong rather than dropping it from the total", async () => {
    expect((await submitGrid("MULTIPLE_CHOICE_GRID", allCorrect.slice(0, 1))).score).toBe(25);
  });

  it("gives a wholly unanswered grid zero, not free marks", async () => {
    // The failure mode that bit the section/text blocks: an empty submitted set matching an empty
    // correct set and scoring as correct.
    expect((await submitGrid("MULTIPLE_CHOICE_GRID", [])).score).toBe(0);
  });

  it("requires an exact match on a checkbox grid row", async () => {
    // Row 1's key is column 1 only, so adding a second column makes that row wrong outright -
    // Google is all-or-nothing within a checkbox row.
    const grid = [{ rowId: "11", columnIds: ["21", "22"] }, ...allCorrect.slice(1)];
    expect((await submitGrid("CHECKBOX_GRID", grid)).score).toBe(75);
  });

  it("ignores a column id that is not on the question", async () => {
    const grid = [{ rowId: "11", columnIds: ["21", "999"] }, ...allCorrect.slice(1)];
    expect((await submitGrid("MULTIPLE_CHOICE_GRID", grid)).score).toBe(100);
  });
});

describe("submitEvaluation - grids are stored, and never scored", () => {
  /**
   * Evaluations are not graded. These two tests pin that down from opposite directions: the grid
   * answer must actually reach the database, and what reaches it must carry nothing score-shaped.
   */
  const submitGrid = async (grid: Array<{ rowId: string; columnIds: string[] }>) => {
    const { db, evaluationAnswers } = buildFakeDb({
      courseFormIds: { evaluation: BigInt(601) },
    });
    const repo = createTrainingFormsRepository(db);
    await repo.submitEvaluation(
      "1",
      "EVALUATION",
      { answers: [{ questionId: "1", optionIds: [], ratingValue: null, text: null, grid }] },
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    return evaluationAnswers;
  };

  it("writes one row per picked cell, carrying the row it belongs to", async () => {
    // The bug this guards: a grid sends optionIds: [] and puts its picks in `grid`, so an
    // empty-optionIds check placed first swallowed the whole answer and stored nothing.
    const rows = await submitGrid([
      { rowId: "31", columnIds: ["41"] },
      { rowId: "32", columnIds: ["42", "43"] },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => [String(row.row_option_id), String(row.evaluation_option_id)])).toEqual([
      ["31", "41"],
      ["32", "42"],
      ["32", "43"],
    ]);
  });

  it("stores nothing score-shaped on an evaluation answer", async () => {
    // evaluation_answer has no score column at all, and nothing in the grid work added one -
    // rating_value is the 1-5 scale of a RATING question, not a mark.
    const rows = await submitGrid([{ rowId: "31", columnIds: ["41"] }]);
    for (const row of rows) {
      expect(row.rating_value).toBeNull();
      expect(row).not.toHaveProperty("score_awarded");
      expect(row).not.toHaveProperty("is_correct");
      expect(row).not.toHaveProperty("option_score");
      expect(row).not.toHaveProperty("correct_columns");
    }
  });
});
