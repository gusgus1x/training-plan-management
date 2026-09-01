import { describe, expect, it } from "vitest";
import { Prisma } from "../../app/generated/prisma/client";
import { createEnrollmentRepository } from "../../app/lib/trainingEnrollment/repository";

/**
 * mapEnrollment's stage-info enrichment (Phase 3.1 of the assessment/evaluation forms plan) - the
 * per-stage opensAt/availability/submission fields that RecordModule and UserDashboard rely on
 * without a second request. A fake training_enrollment.findMany result, not the live database.
 */

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const START = new Date(NOW - DAY_MS).toISOString();
const END = new Date(NOW - 12 * 60 * 60 * 1000).toISOString();

const buildRow = (overrides: {
  closedSettings?: Array<{ assessment_stage: string; close_at: Date }>;
  assessmentSubmissions?: Array<{ assessment_id: bigint; assessment_stage: string; attempt_no: number; submitted_at: Date | null; score: Prisma.Decimal | null; pass_status: string; grading_status: string }>;
  evaluationSubmissions?: Array<{ evaluation_form_id: bigint; submitted_at: Date | null }>;
  preAssessmentId?: bigint | null;
  postAssessmentId?: bigint | null;
  evaluationFormId?: bigint | null;
  evaluation30FormId?: bigint | null;
} = {}) => ({
  enrollment_id: BigInt(1),
  plan_id: BigInt(1),
  employee_user_id: "USER-101",
  approval_status: "APPROVED",
  reject_reason: null,
  queue_override_reason: null,
  enrollment_source: "EMPLOYEE",
  target_match_status: "MATCHED",
  level_match_status: "NOT_REQUIRED",
  enrolled_at: new Date(START),
  approved_by: null,
  approved_at: null,
  attendance: null,
  training_result: null,
  assessment_submission: overrides.assessmentSubmissions ?? [],
  evaluation_submission: overrides.evaluationSubmissions ?? [],
  employee: {
    employee_id: BigInt(101),
    user_id: "USER-101",
    employee_code: "E101",
    title_th: null,
    title_en: null,
    first_name_th: "ทดสอบ",
    last_name_th: "ระบบ",
    first_name_en: null,
    last_name_en: null,
    company: { company_code: "ATA" },
    organization_function: null,
    section: null,
    division: null,
    department: null,
    position: null,
    employee_level: null,
  },
  training_plan: {
    plan_code: "PLAN-001",
    plan_name: "Sample plan",
    batch_name: "Batch 1",
    batch_no: 1,
    venue: null,
    start_datetime: new Date(START),
    end_datetime: new Date(END),
    training_plan_assessment_setting: overrides.closedSettings ?? [],
    training_plan_oap: {
      company_id: null,
      course_name_snapshot: "Sample course",
      planned_duration_hours: 6,
      instructor_name_text: null,
      provider_name_text: null,
      course: {
        course_code: "SC-001",
        pre_assessment_id: overrides.preAssessmentId ?? BigInt(501),
        pre_test_link: null,
        post_assessment_id: overrides.postAssessmentId ?? BigInt(501),
        post_test_link: null,
        evaluation_form_id: overrides.evaluationFormId ?? null,
        evaluation_link: null,
        evaluation_form_after_30day_id: overrides.evaluation30FormId ?? null,
        evaluation_after_30day_link: null,
        validity_months: null,
      },
    },
  },
});

const repoWithRow = (row: ReturnType<typeof buildRow>) => {
  const db = {
    training_enrollment: { findMany: async () => [row] },
  } as any;
  return createEnrollmentRepository(db);
};

describe("mapEnrollment stage info", () => {
  it("closing PRE_TEST does not also close POST_TEST", async () => {
    const row = buildRow({ closedSettings: [{ assessment_stage: "PRE_TEST", close_at: new Date(NOW - 1000) }] });
    const repo = repoWithRow(row);
    const [enrollment] = await repo.list({ planId: null, employeeId: null, employeeUserId: null }, null);
    expect(enrollment.plan.assessment.preTest.availability).toBe("CLOSED_BY_HRD");
    expect(enrollment.plan.assessment.postTest.availability).toBe("OPEN");
  });

  it("picks the highest attempt_no as the latest submission, not the first row", async () => {
    const row = buildRow({
      assessmentSubmissions: [
        { assessment_id: BigInt(501), assessment_stage: "PRE_TEST", attempt_no: 1, submitted_at: new Date(START), score: new Prisma.Decimal(40), pass_status: "FAIL", grading_status: "REVIEWED" },
        { assessment_id: BigInt(501), assessment_stage: "PRE_TEST", attempt_no: 2, submitted_at: new Date(START), score: new Prisma.Decimal(90), pass_status: "PASS", grading_status: "REVIEWED" },
      ],
    });
    const repo = repoWithRow(row);
    const [enrollment] = await repo.list({ planId: null, employeeId: null, employeeUserId: null }, null);
    expect(enrollment.plan.assessment.preTest.submission?.attemptNo).toBe(2);
    expect(enrollment.plan.assessment.preTest.submission?.score).toBe(90);
  });

  it("does not cross-attribute a PRE_TEST submission to POST_TEST even when both use the same assessment", async () => {
    const row = buildRow({
      assessmentSubmissions: [
        { assessment_id: BigInt(501), assessment_stage: "PRE_TEST", attempt_no: 1, submitted_at: new Date(START), score: new Prisma.Decimal(100), pass_status: "PASS", grading_status: "REVIEWED" },
      ],
    });
    const repo = repoWithRow(row);
    const [enrollment] = await repo.list({ planId: null, employeeId: null, employeeUserId: null }, null);
    expect(enrollment.plan.assessment.preTest.submission).not.toBeNull();
    expect(enrollment.plan.assessment.postTest.submission).toBeNull();
  });

  it("matches each evaluation submission to its own form id, not the other evaluation stage", async () => {
    const row = buildRow({
      evaluationFormId: BigInt(601),
      evaluation30FormId: BigInt(602),
      evaluationSubmissions: [{ evaluation_form_id: BigInt(601), submitted_at: new Date(START) }],
    });
    const repo = repoWithRow(row);
    const [enrollment] = await repo.list({ planId: null, employeeId: null, employeeUserId: null }, null);
    expect(enrollment.plan.assessment.evaluation.submission).not.toBeNull();
    expect(enrollment.plan.assessment.evaluationAfter30Day.submission).toBeNull();
  });

  it("evaluation stages are never closable, even if a setting row somehow named one", async () => {
    const row = buildRow({
      evaluationFormId: BigInt(601),
      closedSettings: [{ assessment_stage: "EVALUATION", close_at: new Date(NOW - 1000) }],
    });
    const repo = repoWithRow(row);
    const [enrollment] = await repo.list({ planId: null, employeeId: null, employeeUserId: null }, null);
    expect(enrollment.plan.assessment.evaluation.availability).toBe("OPEN");
  });
});
