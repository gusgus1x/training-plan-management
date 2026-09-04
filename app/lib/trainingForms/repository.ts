import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { CLOSABLE_STAGES, stageAvailability, stageOpensAt, type FormStageKey } from "./availability";
import { FREE_TEXT_MIN_RESPONDENTS } from "./types";
import type {
  AssessmentForEmployee,
  AssessmentReview,
  EvaluationForEmployee,
  EvaluationSummary,
  EvaluationSummaryQuestion,
  EvaluationTimingStage,
  GradeSubmissionInput,
  GradedStage,
  SetStageClosedInput,
  StageSetting,
  SubmitAssessmentInput,
  SubmitEvaluationInput,
  SubmissionSummary,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  | "training_enrollment"
  | "training_plan"
  | "training_plan_assessment_setting"
  | "assessment"
  | "assessment_submission"
  | "assessment_answer"
  | "evaluation_form"
  | "evaluation_submission"
  | "evaluation_answer"
  | "training_result"
  | "$transaction"
>;

const forbidden = (message: string) => new ApiError({ code: "FORBIDDEN", message, status: 403 });
const notFound = (message: string) => new ApiError({ code: "RESOURCE_NOT_FOUND", message, status: 404 });

// Same enrollmentInclude shape as trainingEnrollment/repository.ts needs for its own stage
// resolution - kept local rather than imported so this module has no dependency on that one's
// larger include (attendance, employee profile, etc.) that this code never reads.
const planWithCourseInclude = {
  training_plan_oap: {
    select: {
      company_id: true,
      course: {
        select: {
          pre_assessment_id: true,
          pre_test_link: true,
          post_assessment_id: true,
          post_test_link: true,
          evaluation_form_id: true,
          evaluation_form_after_30day_id: true,
        },
      },
    },
  },
} satisfies Prisma.training_planInclude;

type PlanWithCourse = Prisma.training_planGetPayload<{ include: typeof planWithCourseInclude }>;

/**
 * The batch's own choice wins over the course's, so HRD can swap one month's pre-test without
 * touching the course every other batch shares. NULL on the batch means "use the course's", which
 * is what every batch created before this existed still holds.
 *
 * Every read path - opening a form, submitting one, My Record, the evaluation summary - resolves
 * the form through this one function, so the override cannot apply in some places and not others.
 */
const formIdForStage = (plan: PlanWithCourse, stage: FormStageKey): bigint | null => {
  const course = plan.training_plan_oap.course;
  // Per stage, the batch's choice REPLACES the course's rather than merging with it: a batch that
  // points a stage at an external link has deliberately opted out of the in-system form, so
  // falling back to the course's assessment there would hand the trainee a test they were never
  // meant to take. Only a batch that set neither an id nor a link follows its course.
  switch (stage) {
    case "PRE_TEST":
      return plan.pre_assessment_id ?? (plan.pre_test_link?.trim() ? null : course.pre_assessment_id);
    case "POST_TEST":
      return plan.post_assessment_id ?? (plan.post_test_link?.trim() ? null : course.post_assessment_id);
    case "EVALUATION":
      return plan.evaluation_form_id ?? (plan.evaluation_link?.trim() ? null : course.evaluation_form_id);
    case "EVALUATION_30DAY":
      return (
        plan.evaluation_form_after_30day_id ??
        (plan.evaluation_after_30day_link?.trim() ? null : course.evaluation_form_after_30day_id)
      );
  }
};

/**
 * Loads the enrollment + its plan/course and confirms `principal` (an EMPLOYEE) actually owns it.
 * Same either-key rule as trainingEnrollment/repository.ts updateStatus - proven by employeeUserId
 * OR employeeId, never assumed from either alone.
 */
const loadOwnedEnrollment = async (
  db: DatabaseClient,
  enrollmentId: string,
  employeeId: string | null,
  employeeUserId: string | null,
) => {
  const enrollment = await db.training_enrollment.findUnique({
    where: { enrollment_id: BigInt(enrollmentId) },
    include: {
      training_plan: { include: planWithCourseInclude },
      // training_enrollment only stores employee_user_id (the durable key) directly - the
      // surrogate employee_id lives one hop away on the employee relation, same as
      // trainingEnrollment/repository.ts's updateStatus ownership check.
      employee: { select: { employee_id: true } },
    },
  });
  if (!enrollment) throw notFound("Enrollment not found");

  const ownsByDurableKey = employeeUserId !== null && enrollment.employee_user_id === employeeUserId;
  const ownsBySurrogateKey = employeeId !== null && enrollment.employee.employee_id.toString() === employeeId;
  if (!ownsByDurableKey && !ownsBySurrogateKey) {
    throw forbidden("You can only access your own training records");
  }
  if (enrollment.approval_status !== "APPROVED") {
    throw forbidden("This registration has not been approved yet");
  }

  return enrollment;
};

const assertStageOpen = async (
  db: DatabaseClient,
  planId: bigint,
  stage: FormStageKey,
  startAt: Date,
  endAt: Date,
) => {
  let closedAt: string | null = null;
  if (CLOSABLE_STAGES.includes(stage)) {
    const setting = await db.training_plan_assessment_setting.findUnique({
      where: { plan_id_assessment_stage: { plan_id: planId, assessment_stage: stage } },
      select: { close_at: true },
    });
    closedAt = setting?.close_at.toISOString() ?? null;
  }

  const availability = stageAvailability(stage, startAt.toISOString(), endAt.toISOString(), closedAt, new Date());
  if (availability.state === "NOT_YET") {
    throw new ApiError({
      code: "STAGE_NOT_OPEN",
      message: `This form opens on ${availability.opensAt}`,
      status: 403,
      details: { opensAt: availability.opensAt },
    });
  }
  if (availability.state === "CLOSED_BY_HRD") {
    throw new ApiError({ code: "STAGE_CLOSED", message: "HRD has closed this form", status: 409 });
  }
};

const assessmentDetailSelect = {
  assessment_id: true,
  instructions: true,
  time_limit_minutes: true,
  passing_score_percent: true,
  assessment_series: { select: { series_name: true } },
  assessment_question: {
    orderBy: { question_order: "asc" as const },
    select: {
      question_id: true,
      question_order: true,
      question_text: true,
      question_type: true,
      question_score: true,
      is_required: true,
      assessment_choice: {
        orderBy: { choice_order: "asc" as const },
        select: { choice_id: true, choice_order: true, choice_text: true },
      },
    },
  },
} satisfies Prisma.assessmentSelect;

/** The employee never sees a score the publication gate has not opened yet. Withheld here rather
 *  than in the component: this projection is what leaves the server, so a screen that forgets the
 *  check cannot leak a held-back grade. */
const mapSubmission = (
  row: Pick<
    Prisma.assessment_submissionGetPayload<Record<string, never>>,
    "submission_id" | "attempt_no" | "submitted_at" | "score" | "pass_status" | "status" | "grading_status" | "publication_status"
  >,
): SubmissionSummary => {
  const resultsPublished = row.publication_status === "PUBLISHED";
  return {
    submissionId: row.submission_id.toString(),
    attemptNo: row.attempt_no,
    submittedAt: row.submitted_at?.toISOString() ?? null,
    score: !resultsPublished || row.score === null ? null : Number(row.score),
    passStatus: resultsPublished ? (row.pass_status as SubmissionSummary["passStatus"]) : "PENDING",
    status: row.status as SubmissionSummary["status"],
    gradingStatus: row.grading_status as SubmissionSummary["gradingStatus"],
    resultsPublished,
  };
};

export type TrainingFormsRepository = ReturnType<typeof createTrainingFormsRepository>;

export const createTrainingFormsRepository = (client?: DatabaseClient) => {
  const db = () => client ?? getPrismaClient();

  return {
    async readAssessmentForEmployee(
      enrollmentId: string,
      stage: GradedStage,
      employeeId: string | null,
      employeeUserId: string | null,
    ): Promise<AssessmentForEmployee> {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId);
        const assessmentId = formIdForStage(enrollment.training_plan, stage);
        if (assessmentId === null) {
          throw notFound("This course has no form configured for this stage");
        }
        await assertStageOpen(
          db(),
          enrollment.plan_id,
          stage,
          enrollment.training_plan.start_datetime,
          enrollment.training_plan.end_datetime,
        );

        const assessment = await db().assessment.findUniqueOrThrow({
          where: { assessment_id: assessmentId },
          select: assessmentDetailSelect,
        });

        const submissions = await db().assessment_submission.findMany({
          where: { enrollment_id: enrollment.enrollment_id, assessment_id: assessmentId, assessment_stage: stage },
          orderBy: { attempt_no: "desc" },
          select: {
            submission_id: true,
            attempt_no: true,
            submitted_at: true,
            score: true,
            pass_status: true,
            status: true,
            grading_status: true,
            publication_status: true,
          },
        });

        return {
          assessmentId: assessment.assessment_id.toString(),
          seriesName: assessment.assessment_series.series_name,
          instructions: assessment.instructions,
          timeLimitMinutes: assessment.time_limit_minutes,
          passingScorePercent: assessment.passing_score_percent.toFixed(2),
          questions: assessment.assessment_question.map((question) => ({
            questionId: question.question_id.toString(),
            questionOrder: question.question_order,
            questionText: question.question_text,
            questionType: question.question_type as AssessmentForEmployee["questions"][number]["questionType"],
            questionScore: question.question_score.toFixed(2),
            isRequired: question.is_required,
            choices: question.assessment_choice.map((choice) => ({
              choiceId: choice.choice_id.toString(),
              choiceOrder: choice.choice_order,
              choiceText: choice.choice_text,
            })),
          })),
          submissions: submissions.map(mapSubmission),
        };
      });
    },

    /** The employee's own marked paper for one stage: their latest RELEASED attempt, reduced to the
     *  questions they did not get full marks on.
     *
     *  Never includes which choice was correct. Attempts are repeatable, so handing back the answer
     *  key would turn a retake into a memory test - the employee is meant to go back to the
     *  material. Returns null while nothing has been released, which is the same thing the score
     *  projections already do. */
    async readAssessmentReviewForEmployee(
      enrollmentId: string,
      stage: GradedStage,
      employeeId: string | null,
      employeeUserId: string | null,
    ): Promise<AssessmentReview | null> {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId);
        const assessmentId = formIdForStage(enrollment.training_plan, stage);
        if (assessmentId === null) return null;

        const submission = await db().assessment_submission.findFirst({
          where: {
            enrollment_id: enrollment.enrollment_id,
            assessment_id: assessmentId,
            assessment_stage: stage,
            publication_status: "PUBLISHED",
          },
          orderBy: { attempt_no: "desc" },
          select: {
            submission_id: true,
            attempt_no: true,
            submitted_at: true,
            score: true,
            pass_status: true,
            assessment: {
              select: {
                passing_score_percent: true,
                assessment_question: {
                  orderBy: { question_order: "asc" },
                  select: { question_id: true, question_order: true, question_text: true, question_score: true },
                },
              },
            },
            assessment_answer: {
              select: { question_id: true, score_awarded: true, review_comment: true },
            },
          },
        });
        if (!submission) return null;

        // submitAssessment puts a question's whole award on its first answer row only, so summing
        // rows per question is right and does not multiply a multi-select answer.
        const awardedByQuestion = new Map<string, Prisma.Decimal>();
        const commentByQuestion = new Map<string, string>();
        for (const answer of submission.assessment_answer) {
          const questionId = answer.question_id.toString();
          awardedByQuestion.set(
            questionId,
            (awardedByQuestion.get(questionId) ?? new Prisma.Decimal(0)).add(answer.score_awarded ?? new Prisma.Decimal(0)),
          );
          if (answer.review_comment) commentByQuestion.set(questionId, answer.review_comment);
        }

        let totalAwarded = new Prisma.Decimal(0);
        let totalPossible = new Prisma.Decimal(0);
        const missedQuestions: AssessmentReview["missedQuestions"] = [];

        for (const question of submission.assessment.assessment_question) {
          const questionId = question.question_id.toString();
          const awarded = awardedByQuestion.get(questionId) ?? new Prisma.Decimal(0);
          totalAwarded = totalAwarded.add(awarded);
          totalPossible = totalPossible.add(question.question_score);

          // "Missed" means anything short of full marks - a partially credited written answer is
          // exactly the kind of question worth going back to.
          if (awarded.lt(question.question_score)) {
            missedQuestions.push({
              questionId,
              questionOrder: question.question_order,
              questionText: question.question_text,
              scoreAwarded: Number(awarded),
              questionScore: Number(question.question_score),
              reviewComment: commentByQuestion.get(questionId) ?? null,
            });
          }
        }

        return {
          submissionId: submission.submission_id.toString(),
          attemptNo: submission.attempt_no,
          submittedAt: submission.submitted_at?.toISOString() ?? null,
          scorePercent: submission.score === null ? null : Number(submission.score),
          passStatus: submission.pass_status as AssessmentReview["passStatus"],
          passingScorePercent: Number(submission.assessment.passing_score_percent),
          totalAwarded: Number(totalAwarded),
          totalPossible: Number(totalPossible),
          missedQuestions,
        };
      });
    },

    async submitAssessment(
      enrollmentId: string,
      stage: GradedStage,
      input: SubmitAssessmentInput,
      employeeId: string | null,
      employeeUserId: string | null,
    ): Promise<SubmissionSummary> {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId);
        const assessmentId = formIdForStage(enrollment.training_plan, stage);
        if (assessmentId === null) {
          throw notFound("This course has no form configured for this stage");
        }
        await assertStageOpen(
          db(),
          enrollment.plan_id,
          stage,
          enrollment.training_plan.start_datetime,
          enrollment.training_plan.end_datetime,
        );

        const questions = await db().assessment.findUniqueOrThrow({
          where: { assessment_id: assessmentId },
          select: {
            passing_score_percent: true,
            assessment_question: {
              select: {
                question_id: true,
                question_type: true,
                question_score: true,
                assessment_choice: { select: { choice_id: true, is_correct: true } },
              },
            },
          },
        });

        const questionsById = new Map(questions.assessment_question.map((q) => [q.question_id.toString(), q]));
        const answersByQuestion = new Map(input.answers.map((a) => [a.questionId, a]));
        for (const questionId of answersByQuestion.keys()) {
          if (!questionsById.has(questionId)) {
            throw new ApiError({ code: "INVALID_INPUT", message: `Question ${questionId} does not belong to this form`, status: 400 });
          }
        }

        const submission = await db().$transaction(async (tx) => {
          const previousAttempts = await tx.assessment_submission.count({
            where: { enrollment_id: enrollment.enrollment_id, assessment_id: assessmentId, assessment_stage: stage },
          });

          let totalPossible = new Prisma.Decimal(0);
          let totalAwarded = new Prisma.Decimal(0);
          let hasPendingReview = false;
          const answerRows: Prisma.assessment_answerCreateManyInput[] = [];

          // Every question on the form counts toward the total, whether or not the client sent an
          // answer for it - scoring off input.answers alone would let an omitted question vanish
          // from the denominator instead of counting as wrong, quietly inflating the percentage.
          for (const [questionId, question] of questionsById) {
            const answer = answersByQuestion.get(questionId) ?? { questionId, choiceIds: [], text: null };
            totalPossible = totalPossible.add(question.question_score);

            if (question.question_type === "SHORT_ANSWER") {
              hasPendingReview = true;
              answerRows.push({
                submission_id: BigInt(0), // placeholder, replaced after submission row exists
                question_id: BigInt(questionId),
                answer_text: answer.text,
                is_correct: null,
                score_awarded: null,
                review_status: "PENDING_REVIEW",
              });
              continue;
            }

            const correctChoiceIds = new Set(
              question.assessment_choice.filter((c) => c.is_correct).map((c) => c.choice_id.toString()),
            );
            const submittedChoiceIds = new Set(answer.choiceIds);
            const isCorrect =
              submittedChoiceIds.size === correctChoiceIds.size &&
              [...submittedChoiceIds].every((id) => correctChoiceIds.has(id));
            const awarded = isCorrect ? question.question_score : new Prisma.Decimal(0);
            totalAwarded = totalAwarded.add(awarded);

            // One assessment_answer row per selected choice (matches how MULTIPLE_CHOICE stores a
            // selection - one row per option, mirroring evaluation_answer's own shape). The whole
            // question's awarded score rides on the first row only, not repeated per row, so a
            // later regrade summing score_awarded across every answer (gradeSubmission) does not
            // double- or triple-count a question with more than one selected choice. A question
            // left entirely unanswered creates no choice rows at all, which is correct - there is
            // no selection to record, only the 0 it already contributed to totalAwarded above.
            for (const choiceId of answer.choiceIds) {
              answerRows.push({
                submission_id: BigInt(0),
                question_id: BigInt(questionId),
                choice_id: BigInt(choiceId),
                is_correct: correctChoiceIds.has(choiceId),
                score_awarded: choiceId === answer.choiceIds[0] ? awarded : new Prisma.Decimal(0),
                review_status: "NOT_REQUIRED",
              });
            }
          }

          const scorePercent = hasPendingReview || totalPossible.isZero()
            ? null
            : totalAwarded.mul(100).div(totalPossible);
          const passStatus = scorePercent === null
            ? "PENDING"
            : scorePercent.gte(questions.passing_score_percent)
              ? "PASS"
              : "FAIL";

          const created = await tx.assessment_submission.create({
            data: {
              enrollment_id: enrollment.enrollment_id,
              assessment_id: assessmentId,
              assessment_stage: stage,
              attempt_no: previousAttempts + 1,
              submitted_at: new Date(),
              score: scorePercent,
              pass_status: passStatus,
              status: hasPendingReview ? "SUBMITTED" : "GRADED",
              grading_status: hasPendingReview ? "PENDING_REVIEW" : "REVIEWED",
              // Nothing for a human to add means the score is final at submit time, so it is
              // released immediately - the same "grades shown right after submitting" behaviour a
              // fully auto-graded Google Forms quiz has. Anything holding a written answer waits
              // for HRD to grade it AND release it (publishSubmissionResults).
              publication_status: hasPendingReview ? "UNPUBLISHED" : "PUBLISHED",
            },
          });

          if (answerRows.length > 0) {
            await tx.assessment_answer.createMany({
              data: answerRows.map((row) => ({ ...row, submission_id: created.submission_id })),
            });
          }

          if (!hasPendingReview) {
            await writeOfficialAssessmentResult(tx, enrollment.enrollment_id, stage);
          }

          return created;
        });

        return mapSubmission(submission);
      });
    },

    async readEvaluationForEmployee(
      enrollmentId: string,
      timing: "EVALUATION" | "EVALUATION_30DAY",
      employeeId: string | null,
      employeeUserId: string | null,
    ): Promise<EvaluationForEmployee> {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId);
        const formId = formIdForStage(enrollment.training_plan, timing);
        if (formId === null) {
          throw notFound("This course has no evaluation form configured for this stage");
        }
        await assertStageOpen(
          db(),
          enrollment.plan_id,
          timing,
          enrollment.training_plan.start_datetime,
          enrollment.training_plan.end_datetime,
        );

        const [form, existing] = await Promise.all([
          db().evaluation_form.findUniqueOrThrow({
            where: { evaluation_form_id: formId },
            select: {
              evaluation_form_id: true,
              form_name: true,
              description: true,
              is_anonymous: true,
              evaluation_question: {
                orderBy: { question_order: "asc" },
                select: {
                  evaluation_question_id: true,
                  question_order: true,
                  question_text: true,
                  question_type: true,
                  section_name: true,
                  is_required: true,
                  evaluation_option: {
                    orderBy: { option_order: "asc" },
                    select: { evaluation_option_id: true, option_order: true, option_text: true },
                  },
                },
              },
            },
          }),
          db().evaluation_submission.findUnique({
            where: { evaluation_form_id_enrollment_id: { evaluation_form_id: formId, enrollment_id: enrollment.enrollment_id } },
            select: { submitted_at: true },
          }),
        ]);

        return {
          evaluationFormId: form.evaluation_form_id.toString(),
          formName: form.form_name,
          description: form.description,
          isAnonymous: form.is_anonymous,
          questions: form.evaluation_question.map((question) => ({
            questionId: question.evaluation_question_id.toString(),
            questionOrder: question.question_order,
            questionText: question.question_text,
            questionType: question.question_type as EvaluationForEmployee["questions"][number]["questionType"],
            sectionName: question.section_name,
            isRequired: question.is_required,
            options: question.evaluation_option.map((option) => ({
              optionId: option.evaluation_option_id.toString(),
              optionOrder: option.option_order,
              optionText: option.option_text,
            })),
          })),
          alreadySubmitted: existing !== null,
          submittedAt: existing?.submitted_at?.toISOString() ?? null,
        };
      });
    },

    async submitEvaluation(
      enrollmentId: string,
      timing: "EVALUATION" | "EVALUATION_30DAY",
      input: SubmitEvaluationInput,
      employeeId: string | null,
      employeeUserId: string | null,
    ) {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId);
        const formId = formIdForStage(enrollment.training_plan, timing);
        if (formId === null) {
          throw notFound("This course has no evaluation form configured for this stage");
        }
        await assertStageOpen(
          db(),
          enrollment.plan_id,
          timing,
          enrollment.training_plan.start_datetime,
          enrollment.training_plan.end_datetime,
        );

        const existing = await db().evaluation_submission.findUnique({
          where: { evaluation_form_id_enrollment_id: { evaluation_form_id: formId, enrollment_id: enrollment.enrollment_id } },
          select: { evaluation_submission_id: true },
        });
        if (existing) {
          throw new ApiError({ code: "ALREADY_SUBMITTED", message: "This evaluation has already been submitted", status: 409 });
        }

        await db().$transaction(async (tx) => {
          const created = await tx.evaluation_submission.create({
            data: {
              evaluation_form_id: formId,
              enrollment_id: enrollment.enrollment_id,
              status: "SUBMITTED",
              started_at: new Date(),
              submitted_at: new Date(),
            },
          });

          const rows: Prisma.evaluation_answerCreateManyInput[] = [];
          for (const answer of input.answers) {
            if (answer.optionIds.length === 0) {
              rows.push({
                evaluation_submission_id: created.evaluation_submission_id,
                evaluation_question_id: BigInt(answer.questionId),
                rating_value: answer.ratingValue === null ? null : new Prisma.Decimal(answer.ratingValue),
                answer_text: answer.text,
              });
              continue;
            }
            for (const optionId of answer.optionIds) {
              rows.push({
                evaluation_submission_id: created.evaluation_submission_id,
                evaluation_question_id: BigInt(answer.questionId),
                evaluation_option_id: BigInt(optionId),
                rating_value: answer.ratingValue === null ? null : new Prisma.Decimal(answer.ratingValue),
                answer_text: answer.text,
              });
            }
          }
          if (rows.length > 0) {
            await tx.evaluation_answer.createMany({ data: rows });
          }
        });

        return { submitted: true as const };
      });
    },

    /** Aggregated answers for one evaluation on one plan.
     *
     *  Deliberately returns counts and text only - never a submission id, an enrollment id, or
     *  anything else that maps an answer back to a person. The form's is_anonymous flag is a
     *  promise made to the employee before they answered, and the safe way to keep it is to build
     *  a projection that cannot break it rather than one a screen must remember not to show. */
    async readEvaluationSummary(
      planId: string,
      timing: EvaluationTimingStage,
      companyId: string | null,
    ): Promise<EvaluationSummary | null> {
      return withDatabaseErrorMapping(async () => {
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: BigInt(planId) },
          include: planWithCourseInclude,
        });
        if (companyId && plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw forbidden("This training plan is outside your permitted scope");
        }

        const formId = formIdForStage(plan, timing);
        if (formId === null) return null;

        const form = await db().evaluation_form.findUniqueOrThrow({
          where: { evaluation_form_id: formId },
          select: {
            evaluation_form_id: true,
            form_name: true,
            description: true,
            is_anonymous: true,
            evaluation_question: {
              orderBy: { question_order: "asc" },
              select: {
                evaluation_question_id: true,
                question_order: true,
                question_text: true,
                question_type: true,
                section_name: true,
                evaluation_option: {
                  orderBy: { option_order: "asc" },
                  select: { evaluation_option_id: true, option_text: true },
                },
              },
            },
          },
        });

        const enrolledCount = await db().training_enrollment.count({ where: { plan_id: BigInt(planId) } });

        const submissions = await db().evaluation_submission.findMany({
          where: {
            evaluation_form_id: formId,
            submitted_at: { not: null },
            training_enrollment: { plan_id: BigInt(planId) },
          },
          select: {
            evaluation_submission_id: true,
            evaluation_answer: {
              select: {
                evaluation_question_id: true,
                evaluation_option_id: true,
                rating_value: true,
                answer_text: true,
              },
            },
          },
        });

        const submittedCount = submissions.length;
        const enoughForFreeText = submittedCount >= FREE_TEXT_MIN_RESPONDENTS;

        // Everything below counts PEOPLE. evaluation_answer holds one row per selected option, so
        // a three-tick MULTIPLE_CHOICE answer arrives as three rows from one respondent; a Set of
        // submission ids per bucket is what keeps that person counted once.
        const respondentsByQuestion = new Map<string, Set<bigint>>();
        const respondentsByOption = new Map<string, Set<bigint>>();
        const ratingsByQuestion = new Map<string, number[]>();
        const textsByQuestion = new Map<string, string[]>();

        const addTo = (map: Map<string, Set<bigint>>, key: string, submissionId: bigint) => {
          const bucket = map.get(key);
          if (bucket) bucket.add(submissionId);
          else map.set(key, new Set([submissionId]));
        };

        for (const submission of submissions) {
          for (const answer of submission.evaluation_answer) {
            const questionId = answer.evaluation_question_id.toString();
            const answered =
              answer.evaluation_option_id !== null ||
              answer.rating_value !== null ||
              (answer.answer_text !== null && answer.answer_text.trim().length > 0);
            if (!answered) continue;

            addTo(respondentsByQuestion, questionId, submission.evaluation_submission_id);

            if (answer.evaluation_option_id !== null) {
              addTo(respondentsByOption, answer.evaluation_option_id.toString(), submission.evaluation_submission_id);
            }
            if (answer.rating_value !== null) {
              const values = ratingsByQuestion.get(questionId);
              if (values) values.push(Number(answer.rating_value));
              else ratingsByQuestion.set(questionId, [Number(answer.rating_value)]);
            }
            if (answer.answer_text !== null && answer.answer_text.trim().length > 0) {
              const texts = textsByQuestion.get(questionId);
              if (texts) texts.push(answer.answer_text.trim());
              else textsByQuestion.set(questionId, [answer.answer_text.trim()]);
            }
          }
        }

        const percent = (part: number, whole: number) =>
          whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

        return {
          evaluationFormId: form.evaluation_form_id.toString(),
          formName: form.form_name,
          description: form.description,
          isAnonymous: form.is_anonymous,
          timing,
          enrolledCount,
          submittedCount,
          responseRatePercent: percent(submittedCount, enrolledCount),
          questions: form.evaluation_question.map((question) => {
            const questionId = question.evaluation_question_id.toString();
            const answeredBy = respondentsByQuestion.get(questionId)?.size ?? 0;
            const ratings = ratingsByQuestion.get(questionId) ?? [];
            const texts = textsByQuestion.get(questionId) ?? [];

            return {
              questionId,
              questionOrder: question.question_order,
              questionText: question.question_text,
              questionType: question.question_type as EvaluationSummaryQuestion["questionType"],
              sectionName: question.section_name,
              answeredBy,
              averageRating: ratings.length
                ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 100) / 100
                : null,
              ratingDistribution: ratings.length
                ? [1, 2, 3, 4, 5].map((value) => ({ value, count: ratings.filter((entry) => entry === value).length }))
                : [],
              options: question.evaluation_option.map((option) => {
                const count = respondentsByOption.get(option.evaluation_option_id.toString())?.size ?? 0;
                return {
                  optionId: option.evaluation_option_id.toString(),
                  optionText: option.option_text,
                  count,
                  percent: percent(count, answeredBy),
                };
              }),
              // Order is deliberately not preserved: on a small batch, "the third comment" lines up
              // with "the third person to submit" for anyone who can see the attendance list.
              textAnswers: enoughForFreeText ? [...texts].sort((a, b) => a.localeCompare(b)) : [],
              textAnswersWithheld: texts.length > 0 && !enoughForFreeText,
            };
          }),
        };
      });
    },

    /** Everything on one plan still waiting on HRD: submissions with an ungraded SHORT_ANSWER, and
     *  submissions already graded but not yet released to the employee. HRD_FACTORY only ever sees
     *  plans their own company owns. */
    async listPendingGrading(planId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: BigInt(planId) },
          select: { training_plan_oap: { select: { company_id: true } } },
        });
        if (companyId && plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw forbidden("This training plan is outside your permitted scope");
        }

        const rows = await db().assessment_submission.findMany({
          where: {
            training_enrollment: { plan_id: BigInt(planId) },
            publication_status: "UNPUBLISHED",
            submitted_at: { not: null },
          },
          orderBy: { submitted_at: "asc" },
          select: {
            submission_id: true,
            enrollment_id: true,
            assessment_stage: true,
            attempt_no: true,
            submitted_at: true,
            grading_status: true,
            training_enrollment: {
              select: { employee: { select: { employee_code: true, first_name_th: true, last_name_th: true, first_name_en: true, last_name_en: true } } },
            },
            assessment_answer: {
              where: { review_status: "PENDING_REVIEW" },
              select: {
                answer_id: true,
                question_id: true,
                answer_text: true,
                assessment_question: { select: { question_text: true, question_score: true } },
              },
            },
          },
        });

        return rows.map((row) => {
          const employee = row.training_enrollment.employee;
          const employeeName =
            `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
            `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim();
          return {
            submissionId: row.submission_id.toString(),
            enrollmentId: row.enrollment_id.toString(),
            employeeCode: employee.employee_code ?? "",
            employeeName,
            stage: row.assessment_stage as GradedStage,
            attemptNo: row.attempt_no,
            submittedAt: row.submitted_at?.toISOString() ?? null,
            awaitingPublication: row.grading_status === "REVIEWED",
            pendingAnswers: row.assessment_answer.map((answer) => ({
              answerId: answer.answer_id.toString(),
              questionText: answer.assessment_question.question_text,
              questionScore: answer.assessment_question.question_score.toFixed(2),
              answerText: answer.answer_text,
            })),
          };
        });
      });
    },

    /** HRD grades every pending SHORT_ANSWER row on one submission, then recomputes the whole
     *  submission's score/pass and, if it just became the best graded attempt, training_result. */
    async gradeSubmission(submissionId: string, input: GradeSubmissionInput, gradedByUserId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const submission = await db().assessment_submission.findUniqueOrThrow({
          where: { submission_id: BigInt(submissionId) },
          include: {
            assessment_answer: { select: { answer_id: true, question_id: true, score_awarded: true, review_status: true } },
            assessment: { select: { passing_score_percent: true, assessment_question: { select: { question_id: true, question_score: true } } } },
            training_enrollment: { select: { training_plan: { select: { training_plan_oap: { select: { company_id: true } } } } } },
          },
        });

        if (companyId && submission.training_enrollment.training_plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw forbidden("This training plan is outside your permitted scope");
        }

        const pendingIds = new Set(
          submission.assessment_answer.filter((a) => a.review_status === "PENDING_REVIEW").map((a) => a.answer_id.toString()),
        );
        const gradedIds = new Set(input.answers.map((a) => a.answerId));
        const stillPending = [...pendingIds].filter((id) => !gradedIds.has(id));
        if (stillPending.length > 0) {
          throw new ApiError({
            code: "GRADING_INCOMPLETE",
            message: "Every short-answer question must be graded before saving",
            status: 400,
          });
        }

        await db().$transaction(async (tx) => {
          for (const grade of input.answers) {
            await tx.assessment_answer.update({
              where: { answer_id: BigInt(grade.answerId) },
              data: {
                score_awarded: new Prisma.Decimal(grade.scoreAwarded),
                review_status: "REVIEWED",
                review_comment: grade.reviewComment,
                reviewed_by: BigInt(gradedByUserId),
                reviewed_at: new Date(),
              },
            });
          }

          const scoreByQuestion = new Map(input.answers.map((a) => [a.answerId, a.scoreAwarded]));
          const questionScoreById = new Map(
            submission.assessment.assessment_question.map((q) => [q.question_id.toString(), q.question_score]),
          );
          // The denominator is per QUESTION, matching submitAssessment. Summing it per answer row
          // instead counted a multi-select question once per selected choice (three ticks tripled
          // its weight) and dropped an unanswered question entirely, since that stores no rows at
          // all - so a regrade could move the percentage in either direction against the score the
          // same submission was given at submit time.
          let totalPossible = new Prisma.Decimal(0);
          for (const question of submission.assessment.assessment_question) {
            totalPossible = totalPossible.add(question.question_score);
          }

          // The numerator stays per row: submitAssessment puts a question's whole award on its
          // first row only, and each graded SHORT_ANSWER carries its own. Rows whose question is
          // no longer on the assessment are skipped so they cannot award marks the denominator
          // has no room for.
          let totalAwarded = new Prisma.Decimal(0);
          for (const answer of submission.assessment_answer) {
            if (!questionScoreById.has(answer.question_id.toString())) continue;
            const awarded = scoreByQuestion.has(answer.answer_id.toString())
              ? new Prisma.Decimal(scoreByQuestion.get(answer.answer_id.toString())!)
              : (answer.score_awarded ?? new Prisma.Decimal(0));
            totalAwarded = totalAwarded.add(awarded);
          }
          const scorePercent = totalPossible.isZero() ? new Prisma.Decimal(0) : totalAwarded.mul(100).div(totalPossible);
          const passStatus = scorePercent.gte(submission.assessment.passing_score_percent) ? "PASS" : "FAIL";

          await tx.assessment_submission.update({
            where: { submission_id: submission.submission_id },
            data: { score: scorePercent, pass_status: passStatus, status: "GRADED", grading_status: "REVIEWED" },
          });

          // training_result is deliberately NOT written here. Grading and releasing are two acts:
          // the official record and the employee's view of the score both wait for
          // publishSubmissionResults, so HRD can finish marking without the grade going out.
        });

        return { graded: true as const };
      });
    },

    /** Releases one graded submission to the employee: the score becomes visible and the official
     *  training_result row is written from it. Idempotent - publishing twice changes nothing. */
    async publishSubmissionResults(submissionId: string, publishedByUserId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const submission = await db().assessment_submission.findUniqueOrThrow({
          where: { submission_id: BigInt(submissionId) },
          select: {
            submission_id: true,
            enrollment_id: true,
            assessment_stage: true,
            grading_status: true,
            publication_status: true,
            training_enrollment: { select: { training_plan: { select: { training_plan_oap: { select: { company_id: true } } } } } },
          },
        });

        if (companyId && submission.training_enrollment.training_plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw forbidden("This training plan is outside your permitted scope");
        }
        if (submission.grading_status !== "REVIEWED") {
          throw new ApiError({
            code: "GRADING_INCOMPLETE",
            message: "Grade every written answer before releasing the result",
            status: 400,
          });
        }
        if (submission.publication_status === "PUBLISHED") return { published: true as const };

        await db().$transaction(async (tx) => {
          await tx.assessment_submission.update({
            where: { submission_id: submission.submission_id },
            data: { publication_status: "PUBLISHED", published_by: BigInt(publishedByUserId), published_at: new Date() },
          });
          await writeOfficialAssessmentResult(tx, submission.enrollment_id, submission.assessment_stage as GradedStage);
        });

        return { published: true as const };
      });
    },

    async listPlanStageSettings(planId: string, companyId: string | null): Promise<StageSetting[]> {
      return withDatabaseErrorMapping(async () => {
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: BigInt(planId) },
          include: planWithCourseInclude,
        });
        if (companyId && plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw forbidden("This training plan is outside your permitted scope");
        }

        const rows = await db().training_plan_assessment_setting.findMany({
          where: { plan_id: BigInt(planId), assessment_stage: { in: [...CLOSABLE_STAGES] } },
          select: { assessment_stage: true, close_at: true },
        });
        const byStage = new Map(rows.map((r) => [r.assessment_stage, r.close_at]));

        return CLOSABLE_STAGES.map((stage) => {
          const graded = stage as GradedStage;
          const formId = formIdForStage(plan, graded);
          const link = graded === "PRE_TEST" ? plan.training_plan_oap.course.pre_test_link : plan.training_plan_oap.course.post_test_link;
          const mode = formId !== null ? "FORM" : link && link.trim() ? "LINK" : "NONE";
          return {
            stage: graded,
            mode,
            opensAt: stageOpensAt(graded, plan.start_datetime.toISOString(), plan.end_datetime.toISOString()),
            closedAt: byStage.get(stage)?.toISOString() ?? null,
          };
        });
      });
    },

    async setStageClosed(planId: string, input: SetStageClosedInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: BigInt(planId) },
          include: planWithCourseInclude,
        });

        if (companyId && plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw forbidden("This training plan is outside your permitted scope");
        }

        if (formIdForStage(plan, input.stage) === null) {
          throw notFound("This course has no form configured for this stage");
        }

        if (!input.closed) {
          await db().training_plan_assessment_setting.deleteMany({
            where: { plan_id: BigInt(planId), assessment_stage: input.stage },
          });
          return { closed: false as const };
        }

        // open_at only has to satisfy CK_RC2_plan_assessment_window (close_at > open_at) - this
        // table's own open_at is not what the app treats as authoritative for "when a stage opens"
        // (availability.ts computes that from the plan's own dates), so it is set here purely to
        // keep the row's date columns internally consistent, not read back by anything.
        const opensAt = new Date(stageOpensAt(input.stage, plan.start_datetime.toISOString(), plan.end_datetime.toISOString()));
        const now = new Date();
        const closeAt = now.getTime() > opensAt.getTime() ? now : new Date(opensAt.getTime() + 1000);

        await db().training_plan_assessment_setting.upsert({
          where: { plan_id_assessment_stage: { plan_id: BigInt(planId), assessment_stage: input.stage } },
          create: {
            plan_id: BigInt(planId),
            assessment_stage: input.stage,
            open_at: opensAt,
            close_at: closeAt,
            created_by: BigInt(userId),
          },
          update: { close_at: closeAt, updated_by: BigInt(userId), updated_at: now },
        });
        return { closed: true as const };
      });
    },
  };
};

/**
 * Picks the best fully-graded attempt for one enrollment+stage (BEST_SCORE - the only value
 * CK_RC2_training_plan_assessment_setting_score_selection_policy_enum allows) and writes it onto
 * training_result. Only ever touches pre_score/post_score/official_*_submission_id - never
 * completion_status/completed_at/valid_until/certificate_no, which stay HRD's decision alone
 * (trainingRecord/repository.ts saveResults owns those, and TrainingActual.tsx prefills from
 * training_result so this write is never silently clobbered by the next HRD save).
 */
const writeOfficialAssessmentResult = async (
  tx: Prisma.TransactionClient,
  enrollmentId: bigint,
  stage: GradedStage,
) => {
  // Published attempts only. A graded-but-unreleased attempt already carries a score, and picking
  // the best across every attempt let that held-back score become the official pre/post result -
  // which My Record shows - defeating the publication gate the projections enforce.
  const best = await tx.assessment_submission.findFirst({
    where: {
      enrollment_id: enrollmentId,
      assessment_stage: stage,
      score: { not: null },
      publication_status: "PUBLISHED",
    },
    orderBy: [{ score: "desc" }, { submitted_at: "desc" }],
    select: { submission_id: true, score: true },
  });
  if (!best) return;

  const data =
    stage === "PRE_TEST"
      ? { pre_score: best.score, official_pre_submission_id: best.submission_id }
      : { post_score: best.score, official_post_submission_id: best.submission_id };

  await tx.training_result.upsert({
    where: { enrollment_id: enrollmentId },
    create: { enrollment_id: enrollmentId, ...data },
    update: data,
  });
};

export const trainingFormsRepository = createTrainingFormsRepository();
