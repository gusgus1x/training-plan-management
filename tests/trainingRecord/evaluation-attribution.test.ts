import { describe, expect, it, vi } from "vitest";
import { createTrainingRecordRepository } from "../../app/lib/trainingRecord/repository";

/**
 * Who answered which evaluation, as the Training Record page reports it.
 *
 * Two different answers can sit on one enrollment: the attendee's own verdict on the course, and
 * their supervisor's 30-day follow-up about them. Telling them apart needs BOTH the respondent and
 * the form - matching on one alone credits an answer to the wrong person or the wrong stage, and
 * that is what made HRD read "answered" for somebody who had not, and "nobody replied" for somebody
 * who had.
 */

const ATTENDEE = "USER-ATTENDEE";
const BOSS = "USER-BOSS";
const AFTER_TRAINING_FORM = BigInt(3);
const FOLLOW_UP_FORM = BigInt(4);

const buildClient = (submissions: Array<{ form: bigint; respondent: string }>) => ({
  training_plan: {
    findMany: vi.fn().mockResolvedValue([
      {
        plan_id: BigInt(2285),
        evaluation_form_id: AFTER_TRAINING_FORM,
        evaluation_link: null,
        evaluation_form_after_30day_id: FOLLOW_UP_FORM,
        evaluation_after_30day_link: null,
        training_plan_oap: { company_id: BigInt(1), course: {} },
        training_expense: [],
        training_enrollment: [
          {
            enrollment_id: BigInt(1643),
            employee_user_id: ATTENDEE,
            employee: {
              employee_id: BigInt(10),
              employee_code: "E1",
              first_name_th: "ทดสอบ",
              last_name_th: "ระบบ",
              first_name_en: null,
              last_name_en: null,
              company: { company_code: "ATA" },
              organization_function: null,
              division: null,
              department: null,
              section: null,
              position: null,
            },
            attendance: { attendance_status: "PRESENT" },
            assessment_submission: [],
            evaluation_submission: submissions.map((entry, index) => ({
              evaluation_submission_id: BigInt(index + 1),
              evaluation_form_id: entry.form,
              respondent_user_id: entry.respondent,
              submitted_at: new Date("2026-09-09T03:00:00.000Z"),
            })),
            training_result: null,
            training_evaluation_reviewer: {
              reviewer_user_id: BOSS,
              assigned_at: new Date("2026-09-01T03:00:00.000Z"),
              opened_at: null,
              reviewer: {
                user_id: BOSS,
                employee_code: "E9",
                first_name_th: "หัวหน้า",
                last_name_th: "ทดสอบ",
                first_name_en: null,
                last_name_en: null,
                company: { company_code: "ATA" },
                position: null,
                division: null,
                department: null,
                section: null,
                employee_level: null,
              },
            },
          },
        ],
      },
    ]),
  },
});

const readAttendee = async (submissions: Array<{ form: bigint; respondent: string }>) => {
  const repository = createTrainingRecordRepository(
    buildClient(submissions) as unknown as Parameters<typeof createTrainingRecordRepository>[0],
  );
  const [record] = await repository.list(null);
  return record.attendees[0];
};

describe("trainingRecordRepository.list evaluation attribution", () => {
  it("does not report the attendee as done when only their supervisor has answered", async () => {
    const attendee = await readAttendee([{ form: FOLLOW_UP_FORM, respondent: BOSS }]);

    expect(attendee.evaluationCompleted).toBe(false);
    expect(attendee.reviewer?.submitted).toBe(true);
  });

  it("does not report the after-training evaluation as done from a 30-day answer", async () => {
    // Same person, same enrollment, different stage. The column is about the after-training form.
    const attendee = await readAttendee([{ form: FOLLOW_UP_FORM, respondent: ATTENDEE }]);

    expect(attendee.evaluationCompleted).toBe(false);
  });

  it("reports the attendee as done for their own after-training answer", async () => {
    const attendee = await readAttendee([{ form: AFTER_TRAINING_FORM, respondent: ATTENDEE }]);

    expect(attendee.evaluationCompleted).toBe(true);
    expect(attendee.reviewer?.submitted).toBe(false);
  });
});
