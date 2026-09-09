import { describe, expect, it } from "vitest";
import { createTrainingFormsRepository } from "../../app/lib/trainingForms/repository";
import { createRollingPlanRepository } from "../../app/lib/trainingRolling/repository";
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
  pre_test_link?: string | null;
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
      // The review reads every released attempt, so the fake answers with a list.
      findMany: async ({ where }: { where: { assessment_id: bigint } }) => {
        asked.assessmentId = where.assessment_id;
        return [];
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

  it("a batch pointed at an external link does not fall back to the course's assessment", async () => {
    // The batch opted out of the in-system form for that stage. Falling through to the course's
    // assessment would hand the trainee a test nobody meant them to take.
    const { repository, asked } = buildDb({ pre_test_link: "https://forms.gle/example" });
    const review = await repository.readAssessmentReviewForEmployee(
      "1",
      "PRE_TEST",
      OWNER.employeeId,
      OWNER.employeeUserId,
    );
    expect(review).toBeNull();
    expect(asked.assessmentId).toBeUndefined();
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

describe("the start-date lock fires on a change, not on the field being present", () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** Only the calls rollingPlanRepository.update makes on the path under test. */
  const buildRollingDb = (startOffsetMs: number, stored: Record<string, unknown> = {}) => {
    const current = {
      plan_id: BigInt(2205),
      oap_plan_id: BigInt(9),
      start_datetime: new Date(Date.now() + startOffsetMs),
      pre_assessment_id: null,
      post_assessment_id: null,
      evaluation_form_id: null,
      evaluation_form_after_30day_id: null,
      pre_test_link: null,
      post_test_link: null,
      evaluation_link: null,
      evaluation_after_30day_link: null,
      // Enough of a course row for mapCourseSnapshot, which runs on the update's return value.
      training_plan_oap: {
        company_id: null,
        instructor: null,
        company: null,
        course: {
          course_id: BigInt(1),
          course_code: "C-001",
          course_name: "หลักสูตรทดสอบ",
          course_name_en: "Test course",
          objective: null,
          learning_content: null,
          target_group: null,
          methodology: null,
          pre_assessment_id: null,
          post_assessment_id: null,
          evaluation_form_id: null,
          evaluation_form_after_30day_id: null,
          pre_test_link: null,
          post_test_link: null,
          evaluation_link: null,
          evaluation_after_30day_link: null,
          assessment_course_pre_assessment_idToassessment: null,
          assessment_course_post_assessment_idToassessment: null,
          evaluation_form: null,
          evaluation_form_after_30day: null,
          validity_months: null,
          description: null,
          status: "ACTIVE",
          course_type: null,
          course_group: null,
          company_id: null,
          company: null,
          course_standard_course: [],
          created_at: new Date(0),
          updated_at: null,
        },
      },
      training_expense: [],
      status: "OPEN",
      batch_no: 1,
      batch_name: null,
      plan_code: "X-B01",
      plan_name: "X",
      venue: null,
      capacity: 10,
      created_by: BigInt(1),
      created_at: new Date(),
      updated_at: null,
      ...stored,
    };

    const written: { data?: Record<string, unknown> } = {};
    const db = {
      training_plan: {
        findUniqueOrThrow: async () => current,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          written.data = data;
          return current;
        },
      },
    };
    return { db, written };
  };

  const update = async (
    startOffsetMs: number,
    formOverrides: Record<string, string>,
    stored = {},
    extraInput: Record<string, unknown> = {},
  ) => {
    const { db, written } = buildRollingDb(startOffsetMs, stored);
    const repository = createRollingPlanRepository(db as never);
    await repository.update("2205", { venue: "ห้องประชุม A", formOverrides, ...extraInput }, "1", null);
    return written;
  };

  it("lets a started batch save other fields while re-sending its unchanged forms", async () => {
    // The edit form posts the whole batch back on every save, forms included. Keying the lock off
    // the field's presence refused an ordinary venue edit on any batch that had already begun.
    const written = await update(-DAY, {
      preAssessmentId: "",
      postAssessmentId: "",
      evaluationFormId: "",
      evaluationFormAfter30DayId: "",
      preTestLink: "",
      postTestLink: "",
      evaluationLink: "",
      evaluationAfter30DayLink: "",
    });
    expect(written.data?.venue).toBe("ห้องประชุม A");
    expect(written.data).not.toHaveProperty("pre_assessment_id");
  });

  it("still refuses a real form change once the batch has started", async () => {
    await expect(update(-DAY, { preAssessmentId: "900" })).rejects.toMatchObject({
      code: "PLAN_FORMS_LOCKED",
      status: 409,
    });
  });

  it("allows a real form change while the batch is still in the future", async () => {
    const written = await update(DAY, { preAssessmentId: "900" });
    expect(written.data?.pre_assessment_id).toBe(BigInt(900));
  });

  it("treats a re-sent identical id as unchanged, not as a change", async () => {
    const written = await update(-DAY, { preAssessmentId: "900" }, { pre_assessment_id: BigInt(900) });
    expect(written.data).not.toHaveProperty("pre_assessment_id");
  });

  it("allows a form change when the same save also moves the batch into the future", async () => {
    // The stored start_datetime is still in the past when the lock check runs - it must judge the
    // NEW date being saved in this same request, not the stale one, or a legitimate reschedule +
    // form change in one step is refused for no reason.
    const future = new Date(Date.now() + DAY);
    const trainingDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    const written = await update(-DAY, { preAssessmentId: "900" }, {}, { trainingDate, startTime: "09:00" });
    expect(written.data?.pre_assessment_id).toBe(BigInt(900));
  });
});
