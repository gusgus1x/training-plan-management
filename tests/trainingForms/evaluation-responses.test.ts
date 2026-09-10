import { describe, expect, it } from "vitest";
import { Prisma } from "../../app/generated/prisma/client";
import { createTrainingFormsRepository } from "../../app/lib/trainingForms/repository";

/**
 * readEvaluationResponses, the one projection on this screen that carries what a person said rather
 * than how many people said it. The thing worth guarding is the promise the form made: on an
 * anonymous form no name, and no id that could be traced back to one, may leave the server.
 */

const FORM_ID = BigInt(900);
const PLAN_ID = "77";
const ATTENDEE_USER_ID = "USER-ATTENDEE";
const SUPERVISOR_USER_ID = "USER-SUPERVISOR";

type FakeAnswer = {
  evaluation_question_id: bigint;
  evaluation_option_id: bigint | null;
  row_option_id: bigint | null;
  rating_value: Prisma.Decimal | null;
  answer_text: string | null;
};

const answer = (overrides: Partial<FakeAnswer> & { evaluation_question_id: bigint }): FakeAnswer => ({
  evaluation_option_id: null,
  row_option_id: null,
  rating_value: null,
  answer_text: null,
  ...overrides,
});

const buildFakeDb = (opts: {
  isAnonymous: boolean;
  submissions: Array<{
    submitted_at: Date;
    respondent_user_id?: string;
    evaluation_answer: FakeAnswer[];
  }>;
}) => {
  let employeeQueries = 0;
  const db = {
    training_plan: {
      findUniqueOrThrow: async () => ({
        training_plan_oap: {
          company_id: BigInt(2),
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
        form_name: "Standard Course Evaluation",
        is_anonymous: opts.isAnonymous,
        evaluation_question: [
          {
            evaluation_question_id: BigInt(1),
            question_order: 1,
            question_text: "หัวข้อที่ได้ประโยชน์",
            question_type: "MULTIPLE_CHOICE",
            evaluation_option: [
              { evaluation_option_id: BigInt(11), option_text: "ความรู้", axis: null },
              { evaluation_option_id: BigInt(12), option_text: "ทักษะ", axis: null },
            ],
          },
          {
            evaluation_question_id: BigInt(2),
            question_order: 2,
            question_text: "ความพร้อมของวิทยากร",
            question_type: "MULTIPLE_CHOICE_GRID",
            evaluation_option: [
              { evaluation_option_id: BigInt(21), option_text: "เนื้อหา", axis: "ROW" },
              { evaluation_option_id: BigInt(22), option_text: "ดี", axis: "COLUMN" },
            ],
          },
          {
            evaluation_question_id: BigInt(3),
            question_order: 3,
            question_text: "ข้อเสนอแนะ",
            question_type: "LONG_TEXT",
            evaluation_option: [],
          },
        ],
      }),
    },
    evaluation_submission: {
      findMany: async () =>
        opts.submissions.map((submission) => ({
          respondent_user_id: ATTENDEE_USER_ID,
          ...submission,
          training_enrollment: {
            employee_user_id: ATTENDEE_USER_ID,
            employee: { title_th: "นาย", first_name_th: "พนักงาน", last_name_th: "ทดสอบ" },
          },
        })),
    },
    employee: {
      findMany: async () => {
        employeeQueries += 1;
        return [
          {
            user_id: ATTENDEE_USER_ID,
            employee_code: "E-001",
            title_th: "นาง",
            first_name_th: "ทดสอบ",
            last_name_th: "ระบบ",
            position: { position_name_th: "หัวหน้าแผนก" },
          },
        ];
      },
    },
  };

  return {
    repository: createTrainingFormsRepository(db as unknown as Parameters<typeof createTrainingFormsRepository>[0]),
    employeeQueries: () => employeeQueries,
  };
};

describe("readEvaluationResponses", () => {
  it("names the respondent when the form is not anonymous", async () => {
    const { repository } = buildFakeDb({
      isAnonymous: false,
      submissions: [
        {
          submitted_at: new Date("2026-09-01T03:00:00.000Z"),
          evaluation_answer: [
            answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(11) }),
            answer({ evaluation_question_id: BigInt(1), evaluation_option_id: BigInt(12) }),
          ],
        },
      ],
    });

    const list = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null);

    expect(list!.responses).toHaveLength(1);
    expect(list!.responses[0].respondentName).toBe("นาง ทดสอบ ระบบ");
    expect(list!.responses[0].respondentPosition).toBe("หัวหน้าแผนก");
    // The attendee answered for themselves, so there is no separate subject to name.
    expect(list!.responses[0].subjectName).toBeNull();
    // One entry per question, with every tick of a multi-choice answer gathered into it.
    expect(list!.responses[0].answers[0].choices).toEqual(["ความรู้", "ทักษะ"]);
  });

  it("carries no name at all when the form is anonymous, and does not even look one up", async () => {
    // The employee query is the leak that matters: a name fetched and then dropped is a name that
    // somebody's next edit can forget to drop.
    const { repository, employeeQueries } = buildFakeDb({
      isAnonymous: true,
      submissions: [
        {
          submitted_at: new Date("2026-09-01T03:00:00.000Z"),
          evaluation_answer: [answer({ evaluation_question_id: BigInt(3), answer_text: "ดีมาก" })],
        },
      ],
    });

    const list = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null);

    expect(list!.isAnonymous).toBe(true);
    expect(list!.responses[0].respondentName).toBeNull();
    expect(employeeQueries()).toBe(0);
    // A respondent is a position in the list and nothing else: no submission id, no user id.
    expect(list!.responses[0].respondentPosition).toBeNull();
    expect(list!.responses[0].subjectName).toBeNull();
    expect(Object.keys(list!.responses[0]).sort()).toEqual([
      "answers",
      "respondentName",
      "respondentPosition",
      "responseNo",
      "subjectName",
      "submittedAt",
    ]);
  });

  it("writes a grid answer as its row and its column, not the column alone", async () => {
    // A bare "ดี" answers a question nobody asked. The row it belongs to is what makes it a reply.
    const { repository } = buildFakeDb({
      isAnonymous: true,
      submissions: [
        {
          submitted_at: new Date("2026-09-01T03:00:00.000Z"),
          evaluation_answer: [
            answer({
              evaluation_question_id: BigInt(2),
              evaluation_option_id: BigInt(22),
              row_option_id: BigInt(21),
            }),
          ],
        },
      ],
    });

    const list = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null);

    expect(list!.responses[0].answers[0].choices).toEqual(["เนื้อหา: ดี"]);
  });

  it("keeps the attendees' papers apart from their supervisors'", async () => {
    // Both audiences answer the same form about the same enrollment, so a reader that ignored who
    // answered would hand HRD one pile describing nobody.
    const { repository } = buildFakeDb({
      isAnonymous: true,
      submissions: [
        {
          submitted_at: new Date("2026-09-01T03:00:00.000Z"),
          evaluation_answer: [answer({ evaluation_question_id: BigInt(3), answer_text: "จากพนักงาน" })],
        },
        {
          submitted_at: new Date("2026-09-02T03:00:00.000Z"),
          respondent_user_id: SUPERVISOR_USER_ID,
          evaluation_answer: [answer({ evaluation_question_id: BigInt(3), answer_text: "จากหัวหน้า" })],
        },
      ],
    });

    const attendees = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null, "EMPLOYEE");
    const supervisors = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null, "SUPERVISOR");

    expect(attendees!.responses.map((response) => response.answers[0].text)).toEqual(["จากพนักงาน"]);
    expect(supervisors!.responses.map((response) => response.answers[0].text)).toEqual(["จากหัวหน้า"]);
    // Numbering restarts per audience, because it is a position in the list on screen.
    expect(supervisors!.responses[0].responseNo).toBe(1);
  });
});

describe("readEvaluationResponses - who evaluated whom", () => {
  it("names the supervisor, their position, and the attendee the reply is about", async () => {
    // A 30-day reply written by somebody else is only readable if HRD can see both ends of it.
    const { repository } = buildFakeDb({
      isAnonymous: false,
      submissions: [
        {
          submitted_at: new Date("2026-09-02T03:00:00.000Z"),
          respondent_user_id: SUPERVISOR_USER_ID,
          evaluation_answer: [answer({ evaluation_question_id: BigInt(3), answer_text: "ดีขึ้นมาก" })],
        },
      ],
    });

    const list = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null, "SUPERVISOR");
    const reply = list!.responses[0];

    // The fake employee lookup answers for the attendee id only, so the supervisor has no row -
    // which is the honest "unknown", not a crash.
    expect(reply.respondentName).toBeNull();
    expect(reply.subjectName).toBe("นาย พนักงาน ทดสอบ");
  });

  it("withholds the subject too when the form is anonymous", async () => {
    // One supervisor answers for one attendee, so naming the attendee names the supervisor.
    const { repository } = buildFakeDb({
      isAnonymous: true,
      submissions: [
        {
          submitted_at: new Date("2026-09-02T03:00:00.000Z"),
          respondent_user_id: SUPERVISOR_USER_ID,
          evaluation_answer: [answer({ evaluation_question_id: BigInt(3), answer_text: "ดีขึ้นมาก" })],
        },
      ],
    });

    const list = await repository.readEvaluationResponses(PLAN_ID, "EVALUATION", null, "SUPERVISOR");

    expect(list!.responses[0].subjectName).toBeNull();
    expect(list!.responses[0].respondentName).toBeNull();
  });
});
