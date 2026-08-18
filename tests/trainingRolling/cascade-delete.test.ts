import { describe, expect, it, vi } from "vitest";
import { cascadeDeleteTrainingPlans } from "../../app/lib/trainingPlanCascade";

describe("cascadeDeleteTrainingPlans", () => {
  it("does nothing when planIds array is empty", async () => {
    const mockTx = {
      training_enrollment: { findMany: vi.fn(), deleteMany: vi.fn() },
      certificate_import_batch: { findMany: vi.fn(), deleteMany: vi.fn() },
      training_certificate_file: { deleteMany: vi.fn() },
      training_result: { deleteMany: vi.fn() },
      assessment_submission: { findMany: vi.fn(), deleteMany: vi.fn() },
      assessment_answer: { deleteMany: vi.fn() },
      evaluation_submission: { findMany: vi.fn(), deleteMany: vi.fn() },
      evaluation_answer: { deleteMany: vi.fn() },
      attendance: { deleteMany: vi.fn() },
      training_plan_assessment_setting: { deleteMany: vi.fn() },
      training_expense: { deleteMany: vi.fn() },
      training_need_request: { updateMany: vi.fn() },
      training_plan: { deleteMany: vi.fn() },
    };

    await cascadeDeleteTrainingPlans(mockTx as any, []);
    expect(mockTx.training_enrollment.findMany).not.toHaveBeenCalled();
    expect(mockTx.training_plan.deleteMany).not.toHaveBeenCalled();
  });

  it("cascades deletion in correct foreign key order: files -> results -> assessments -> evaluations -> attendance -> enrollments -> batches -> settings -> expenses -> requests -> plans", async () => {
    const callOrder: string[] = [];

    const mockTx = {
      training_enrollment: {
        findMany: vi.fn().mockResolvedValue([{ enrollment_id: BigInt(101) }, { enrollment_id: BigInt(102) }]),
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_enrollment.deleteMany");
        }),
      },
      certificate_import_batch: {
        findMany: vi.fn().mockResolvedValue([{ certificate_import_batch_id: BigInt(201) }]),
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("certificate_import_batch.deleteMany");
        }),
      },
      training_certificate_file: {
        updateMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_certificate_file.updateMany");
        }),
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_certificate_file.deleteMany");
        }),
      },
      training_result: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_result.deleteMany");
        }),
      },
      assessment_submission: {
        findMany: vi.fn().mockResolvedValue([{ submission_id: BigInt(301) }]),
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("assessment_submission.deleteMany");
        }),
      },
      assessment_answer: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("assessment_answer.deleteMany");
        }),
      },
      evaluation_submission: {
        findMany: vi.fn().mockResolvedValue([{ evaluation_submission_id: BigInt(401) }]),
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("evaluation_submission.deleteMany");
        }),
      },
      evaluation_answer: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("evaluation_answer.deleteMany");
        }),
      },
      attendance: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("attendance.deleteMany");
        }),
      },
      training_plan_assessment_setting: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_plan_assessment_setting.deleteMany");
        }),
      },
      training_expense: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_expense.deleteMany");
        }),
      },
      training_need_request: {
        updateMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_need_request.updateMany");
        }),
      },
      training_plan: {
        deleteMany: vi.fn().mockImplementation(async () => {
          callOrder.push("training_plan.deleteMany");
        }),
      },
    };

    await cascadeDeleteTrainingPlans(mockTx as any, [BigInt(1), BigInt(2)]);

    // Verify order
    expect(callOrder).toEqual([
      "training_certificate_file.updateMany",
      "training_result.deleteMany",
      "assessment_answer.deleteMany",
      "assessment_submission.deleteMany",
      "evaluation_answer.deleteMany",
      "evaluation_submission.deleteMany",
      "attendance.deleteMany",
      "training_enrollment.deleteMany",
      "certificate_import_batch.deleteMany",
      "training_plan_assessment_setting.deleteMany",
      "training_expense.deleteMany",
      "training_need_request.updateMany",
      "training_plan.deleteMany",
    ]);

    // Verify training_result was deleted BEFORE assessment_submission
    const resultIdx = callOrder.indexOf("training_result.deleteMany");
    const assessmentSubIdx = callOrder.indexOf("assessment_submission.deleteMany");
    expect(resultIdx).toBeLessThan(assessmentSubIdx);

    // Verify training_certificate_file was updated BEFORE certificate_import_batch
    const certFileIdx = callOrder.indexOf("training_certificate_file.updateMany");
    const certBatchIdx = callOrder.indexOf("certificate_import_batch.deleteMany");
    expect(certFileIdx).toBeLessThan(certBatchIdx);
  });
});
