import { describe, expect, it, vi } from "vitest";
import { createTrainingRecordRepository } from "../../app/lib/trainingRecord/repository";

/**
 * Once the assigned supervisor has submitted the 30-day follow-up, that assignment is closed.
 * Their answers are filed against them by name, so moving the assignment afterwards would leave
 * a submission credited to somebody the record no longer says was asked. The screen hides the
 * controls; these cover the rule itself, which is what actually protects the data.
 */

const ENROLLMENT_ID = "7";
const REVIEWER = "USER-BOSS";

const buildClient = (submittedBy: string[]) => ({
  training_plan: {
    findUniqueOrThrow: vi
      .fn()
      // The scope check reads the plan, then a successful save reads it again to answer with the
      // updated record - which goes through the full mapper, hence the emptier second shape.
      .mockResolvedValueOnce({
        training_plan_oap: { company_id: BigInt(1) },
        training_enrollment: [{ enrollment_id: BigInt(ENROLLMENT_ID) }],
      })
      .mockResolvedValue({
        plan_id: BigInt(1),
        training_plan_oap: { company_id: BigInt(1), course: {} },
        training_expense: [],
        training_enrollment: [],
        evaluation_form_after_30day_id: null,
        evaluation_after_30day_link: null,
      }),
  },
  training_evaluation_reviewer: {
    findMany: vi.fn().mockResolvedValue([
      {
        enrollment_id: BigInt(ENROLLMENT_ID),
        reviewer_user_id: REVIEWER,
        training_enrollment: {
          evaluation_submission: submittedBy.map((respondent) => ({ respondent_user_id: respondent })),
        },
      },
    ]),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
});

const save = (client: unknown, reviewerUserId: string | null) =>
  createTrainingRecordRepository(client as Parameters<typeof createTrainingRecordRepository>[0]).saveReviewers(
    "1",
    { assignments: [{ enrollmentId: ENROLLMENT_ID, reviewerUserId }] },
    "1",
    null,
  );

describe("trainingRecordRepository.saveReviewers", () => {
  it("refuses to reassign an attendee whose reviewer has already answered", async () => {
    const client = buildClient([REVIEWER]);

    await expect(save(client, "USER-SOMEONE-ELSE")).rejects.toMatchObject({
      code: "REVIEWER_ALREADY_ANSWERED",
      status: 409,
    });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to remove that reviewer too - closed means closed either way", async () => {
    const client = buildClient([REVIEWER]);

    await expect(save(client, null)).rejects.toMatchObject({ status: 409 });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("allows the change when the only submission on file is the attendee's own", async () => {
    // The attendee answering their own evaluation says nothing about their supervisor, who may not
    // have been asked yet. Comparing the respondent against the reviewer is what tells them apart.
    const client = buildClient(["USER-ATTENDEE"]);

    await save(client, "USER-SOMEONE-ELSE");

    expect(client.$transaction).toHaveBeenCalled();
  });
});
