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

type Choice = { choice_id: bigint; choice_order: number; choice_text: string; is_correct: boolean };
type Question = {
  question_id: bigint;
  question_order: number;
  question_text: string;
  question_type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "TRUE_FALSE";
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
      createMany: async ({ data }: any) => ({ count: data.length }),
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

  return { db };
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
