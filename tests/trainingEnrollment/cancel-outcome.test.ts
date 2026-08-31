import { describe, expect, it, vi } from "vitest";
import { createEnrollmentRepository } from "../../app/lib/trainingEnrollment/repository";

/**
 * Cancelling an enrollment deletes the row along with its result, attendance, evaluation and
 * assessment submissions. That destruction is the product decision, confirmed — what was wrong was
 * the answer: the API replied with an enrollment carrying `approval_status: "CANCELLED"`, a status
 * the database never stored and, after the delete, a row that no longer existed. It now reports
 * what actually happened.
 *
 * The four deleteMany calls also each carried a `.catch(() => undefined)`. deleteMany on zero rows
 * does not throw, so those only ever hid a genuinely poisoned transaction and made the failure
 * surface against `training_enrollment` instead of the table that really refused.
 */

const enrollmentRow = {
  enrollment_id: BigInt(1),
  employee_user_id: "USER-101",
  approval_status: "APPROVED",
  employee: { employee_id: BigInt(101), company_id: BigInt(2) },
  training_plan: { training_plan_oap: { company_id: BigInt(2) } },
};

const buildClient = () => {
  const tx = {
    training_result: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    attendance: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    evaluation_submission: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    assessment_submission: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    training_enrollment: { delete: vi.fn().mockResolvedValue(enrollmentRow) },
  };

  return {
    tx,
    client: {
      training_enrollment: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(enrollmentRow),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (run: (t: typeof tx) => Promise<unknown>) => run(tx)),
    },
  };
};

const cancelAsCenter = (client: unknown) =>
  createEnrollmentRepository(client as never).updateStatus(
    "1",
    "cancel",
    undefined,
    "9",
    "HRD_CENTER",
    null,
    null,
    null,
  );

describe("enrollment cancel", () => {
  it("reports the deletion instead of a status the database never stored", async () => {
    const { client } = buildClient();

    await expect(cancelAsCenter(client)).resolves.toEqual({
      enrollmentId: "1",
      outcome: "DELETED",
    });
  });

  it("clears the children before removing the enrollment", async () => {
    const { client, tx } = buildClient();

    await cancelAsCenter(client);

    expect(tx.training_result.deleteMany).toHaveBeenCalled();
    expect(tx.attendance.deleteMany).toHaveBeenCalled();
    expect(tx.evaluation_submission.deleteMany).toHaveBeenCalled();
    expect(tx.assessment_submission.deleteMany).toHaveBeenCalled();
    expect(tx.training_enrollment.delete).toHaveBeenCalled();
    // Never an UPDATE: the schema's CANCELLED status stays deliberately unused.
    expect(client.training_enrollment.update).not.toHaveBeenCalled();
  });

  it("surfaces a failed child delete rather than swallowing it", async () => {
    const { client, tx } = buildClient();
    tx.attendance.deleteMany.mockRejectedValueOnce(new Error("attendance is locked"));

    await expect(cancelAsCenter(client)).rejects.toThrow();
    // The enrollment must survive a half-finished cancel.
    expect(tx.training_enrollment.delete).not.toHaveBeenCalled();
  });
});
