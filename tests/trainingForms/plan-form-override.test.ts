import { describe, expect, it } from "vitest";
import { createTrainingFormsRepository } from "../../app/lib/trainingForms/repository";
import { parseUpdateRollingPlan } from "../../app/lib/trainingRolling/validation";

/**
 * A batch may use a different pre-test/post-test/evaluation than its course does. Two rules carry
 * the whole feature: the batch's own choice wins when set, and NULL still means "use the course's"
 * - which is what every batch created before the columns existed holds.
 */

const COURSE_PRE = BigInt(100);
const COURSE_POST = BigInt(101);
const COURSE_EVAL = BigInt(102);
const BATCH_PRE = BigInt(900);

const OWNER = { employeeId: "101", employeeUserId: "USER-101" };
const DAY_MS = 24 * 60 * 60 * 1000;

const buildDb = (planOverrides: {
  pre_assessment_id?: bigint | null;
  post_assessment_id?: bigint | null;
  evaluation_form_id?: bigint | null;
  evaluation_form_after_30day_id?: bigint | null;
}) => {
  const plan = {
    start_datetime: new Date(Date.now() - DAY_MS),
    end_datetime: new Date(Date.now() - DAY_MS / 2),
    pre_assessment_id: null,
    post_assessment_id: null,
    evaluation_form_id: null,
    evaluation_form_after_30day_id: null,
    ...planOverrides,
    training_plan_oap: {
      company_id: BigInt(2),
      course: {
        pre_assessment_id: COURSE_PRE,
        pre_test_link: null,
        post_assessment_id: COURSE_POST,
        post_test_link: null,
        evaluation_form_id: COURSE_EVAL,
        evaluation_form_after_30day_id: null,
      },
    },
  };

  // readAssessmentReviewForEmployee is the shortest path through formIdForStage: it resolves the
  // stage, then looks for a submission against exactly that assessment id. Recording which id it
  // asked for is what proves which form the batch resolves to.
  const asked: { assessmentId?: bigint } = {};
  const db = {
    training_enrollment: {
      findUnique: async () => ({
        enrollment_id: BigInt(1),
        plan_id: BigInt(77),
        approval_status: "APPROVED",
        employee_user_id: OWNER.employeeUserId,
        employee: { employee_id: BigInt(OWNER.employeeId) },
        training_plan: plan,
      }),
    },
    assessment_submission: {
      findFirst: async ({ where }: { where: { assessment_id: bigint } }) => {
        asked.assessmentId = where.assessment_id;
        return null;
      },
    },
  };

  return {
    repository: createTrainingFormsRepository(db as unknown as Parameters<typeof createTrainingFormsRepository>[0]),
    asked,
  };
};

describe("per-batch form overrides", () => {
  it("uses the course's assessment when the batch sets none", async () => {
    const { repository, asked } = buildDb({});
    await repository.readAssessmentReviewForEmployee("1", "PRE_TEST", OWNER.employeeId, OWNER.employeeUserId);
    expect(asked.assessmentId).toBe(COURSE_PRE);
  });

  it("prefers the batch's own assessment over the course's", async () => {
    const { repository, asked } = buildDb({ pre_assessment_id: BATCH_PRE });
    await repository.readAssessmentReviewForEmployee("1", "PRE_TEST", OWNER.employeeId, OWNER.employeeUserId);
    expect(asked.assessmentId).toBe(BATCH_PRE);
  });

  it("overriding one stage leaves the others on the course's forms", async () => {
    const { repository, asked } = buildDb({ pre_assessment_id: BATCH_PRE });
    await repository.readAssessmentReviewForEmployee("1", "POST_TEST", OWNER.employeeId, OWNER.employeeUserId);
    expect(asked.assessmentId).toBe(COURSE_POST);
  });
});

describe("parseUpdateRollingPlan - formOverrides", () => {
  it("accepts an id and accepts an empty string as 'back to the course's form'", () => {
    const parsed = parseUpdateRollingPlan({
      formOverrides: { preAssessmentId: "900", postAssessmentId: "" },
    });
    expect(parsed.formOverrides).toEqual({ preAssessmentId: "900", postAssessmentId: "" });
  });

  it("leaves out a stage that was not sent, so it is not cleared by accident", () => {
    const parsed = parseUpdateRollingPlan({ formOverrides: { preAssessmentId: "900" } });
    expect(parsed.formOverrides).not.toHaveProperty("postAssessmentId");
  });

  it("refuses anything that is not a numeric id", () => {
    expect(() => parseUpdateRollingPlan({ formOverrides: { preAssessmentId: "abc" } })).toThrow();
    expect(() => parseUpdateRollingPlan({ formOverrides: { preAssessmentId: "1; DROP" } })).toThrow();
  });
});
