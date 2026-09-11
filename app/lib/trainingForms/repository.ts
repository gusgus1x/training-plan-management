import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { isFormBlockType } from "../formBlocks";
import { isGridRowCorrect, isGridType, parseCorrectColumns } from "../formGrids";
import { CLOSABLE_STAGES, stageAvailability, stageOpensAt, type FormStageKey } from "./availability";
import { ANSWER_TIME_CAP_SECONDS, FREE_TEXT_MIN_RESPONDENTS } from "./types";
import type {
  AssessmentForEmployee,
  AssessmentReview,
  AssignedEvaluation,
  EvaluationForEmployee,
  EvaluationRespondentGroup,
  EvaluationResponseAnswer,
  EvaluationResponseList,
  EvaluationSummary,
  EvaluationSummaryQuestion,
  EvaluationTimingStage,
  GradeSubmissionInput,
  GradedStage,
  SetStageClosedInput,
  StageSetting,
  SubmissionReview,
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
  | "training_evaluation_reviewer"
  | "training_result"
  // Only for putting a name on a reply, and only when the form is not anonymous.
  | "employee"
  | "$transaction"
>;

/** Title, first name and last name, the way a Thai reply is signed. The title is optional on the
 *  employee record, so it is joined rather than assumed. */
const fullNameTh = (employee: { title_th?: string | null; first_name_th: string; last_name_th: string }) =>
  [employee.title_th ?? "", employee.first_name_th, employee.last_name_th]
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .join(" ");

/** Marks read back as a percentage, for the screens that judge against a pass mark. Nothing stores
 *  this: `assessment_submission.score` is the mark, and the marks it is out of are the paper's. */
const percentOfMarks = (awarded: number, possible: number) =>
  possible <= 0 ? null : Math.round((awarded / possible) * 10000) / 100;

const forbidden = (message: string) => new ApiError({ code: "FORBIDDEN", message, status: 403 });
const notFound = (message: string) => new ApiError({ code: "RESOURCE_NOT_FOUND", message, status: 404 });

// Same enrollmentInclude shape as trainingEnrollment/repository.ts needs for its own stage
// resolution - kept local rather than imported so this module has no dependency on that one's
// larger include (attendance, employee profile, etc.) that this code never reads.
const planWithCourseInclude = {
  training_plan_oap: {
    select: {
      company_id: true,
      // Named on the assignment list, which says which course a supervisor is being asked about.
      course_name_snapshot: true,
      // The rest of the course header a printed report carries.
      instructor_name_text: true,
      course: {
        select: {
          pre_assessment_id: true,
          pre_test_link: true,
          post_assessment_id: true,
          post_test_link: true,
          evaluation_form_id: true,
          evaluation_form_after_30day_id: true,
          // The course's own external links. formIdForStage only needs to know whether the BATCH
          // set one, but a row that has to show the link itself needs the course's fallback too.
          evaluation_link: true,
          evaluation_after_30day_link: true,
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
  // Only the 30-day follow-up passes true. That stage asks what changed in the person since the
  // course, which is what a supervisor is there to answer; the after-training evaluation is the
  // attendee's own verdict on the course, and an exam is nobody's to sit but theirs.
  allowAssignedReviewer = false,
) => {
  const enrollment = await db.training_enrollment.findUnique({
    where: { enrollment_id: BigInt(enrollmentId) },
    include: {
      training_plan: { include: planWithCourseInclude },
      // training_enrollment only stores employee_user_id (the durable key) directly - the
      // surrogate employee_id lives one hop away on the employee relation, same as
      // trainingEnrollment/repository.ts's updateStatus ownership check.
      employee: { select: { employee_id: true } },
      training_evaluation_reviewer: { select: { reviewer_user_id: true } },
    },
  });
  if (!enrollment) throw notFound("Enrollment not found");

  const ownsByDurableKey = employeeUserId !== null && enrollment.employee_user_id === employeeUserId;
  const ownsBySurrogateKey = employeeId !== null && enrollment.employee.employee_id.toString() === employeeId;
  const isAssignedReviewer =
    allowAssignedReviewer &&
    employeeUserId !== null &&
    enrollment.training_evaluation_reviewer?.reviewer_user_id === employeeUserId;
  if (!ownsByDurableKey && !ownsBySurrogateKey && !isAssignedReviewer) {
    throw forbidden("You can only access your own training records");
  }
  if (enrollment.approval_status !== "APPROVED") {
    throw forbidden("This registration has not been approved yet");
  }

  return enrollment;
};

/**
 * Whose answers these are. The assigned supervisor answering about an attendee is the only case
 * where it is not the attendee themselves; everything else - including HRD reading the enrollment
 * by its surrogate key - belongs to the enrollment's own employee.
 */
const respondentUserIdOf = (
  enrollment: { employee_user_id: string; training_evaluation_reviewer: { reviewer_user_id: string } | null },
  employeeUserId: string | null,
) =>
  employeeUserId !== null && enrollment.training_evaluation_reviewer?.reviewer_user_id === employeeUserId
    ? employeeUserId
    : enrollment.employee_user_id;

/**
 * Stamps the first time the assigned supervisor opened this evaluation. Only the first open is
 * recorded, so the value answers "have they acted on it at all" rather than "when did they last
 * look" - and it is never a completion record. Does nothing for the attendee's own visit.
 */
const markReviewerOpened = async (
  db: DatabaseClient,
  enrollment: { enrollment_id: bigint; employee_user_id: string },
  respondentUserId: string,
) => {
  if (respondentUserId === enrollment.employee_user_id) return;
  await db.training_evaluation_reviewer.updateMany({
    where: { enrollment_id: enrollment.enrollment_id, reviewer_user_id: respondentUserId, opened_at: null },
    data: { opened_at: new Date() },
  });
};

/**
 * Records the moment somebody opened the form, as a submission row that carries no answers yet.
 *
 * Nothing else in the system may read this row as "they have answered": every such test is on
 * `submitted_at`, not on the row existing. An unfinished row is a person who opened the form and
 * walked away, which is not the same fact and must never be reported as a reply.
 *
 * Two tabs opened at once race for the same unique key. The upsert's empty update makes the second
 * one a no-op rather than an error, and leaves the first open time standing.
 */
const markEvaluationStarted = async (
  db: DatabaseClient,
  formId: bigint,
  enrollmentId: bigint,
  respondentUserId: string,
) => {
  await db.evaluation_submission.upsert({
    where: submissionKey(formId, enrollmentId, respondentUserId),
    update: {},
    create: {
      evaluation_form_id: formId,
      enrollment_id: enrollmentId,
      respondent_user_id: respondentUserId,
      status: "IN_PROGRESS",
      started_at: new Date(),
    },
  });
};

/**
 * The unique key of one evaluation submission. The respondent is part of it because a supervisor
 * answers the same form about the same enrollment as the employee does. Written once here because
 * dropping the third part silently reads the wrong person's submission rather than failing.
 */
const submissionKey = (formId: bigint, enrollmentId: bigint, respondentUserId: string) => ({
  evaluation_form_id_enrollment_id_respondent_user_id: {
    evaluation_form_id: formId,
    enrollment_id: enrollmentId,
    respondent_user_id: respondentUserId,
  },
});

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
      question_description: true,
      next_section: true,
      is_required: true,
      assessment_choice: {
        orderBy: { choice_order: "asc" as const },
        // next_section and axis are layout/navigation, not correctness, so they are safe to send to
        // the person being tested. option_score and correct_columns are the grid's answer key and
        // must never appear here.
        select: { choice_id: true, choice_order: true, choice_text: true, next_section: true, axis: true },
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
            questionDescription: question.question_description,
            nextSection: question.next_section,
            isRequired: question.is_required,
            choices: question.assessment_choice.map((choice) => ({
              choiceId: choice.choice_id.toString(),
              choiceOrder: choice.choice_order,
              choiceText: choice.choice_text,
              nextSection: choice.next_section,
              axis: choice.axis as AssessmentForEmployee["questions"][number]["choices"][number]["axis"],
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
    /**
     * The employee's own marked paper for one stage.
     *
     * Every released attempt is loaded, not just the last one: a person who sat a test three times
     * has three results worth looking back at, and the one that counts is usually their best rather
     * than their most recent. `attemptNo` opens a specific one; without it the best-scoring attempt
     * is what comes back.
     */
    async readAssessmentReviewForEmployee(
      enrollmentId: string,
      stage: GradedStage,
      employeeId: string | null,
      employeeUserId: string | null,
      attemptNo: number | null = null,
    ): Promise<AssessmentReview | null> {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId);
        const assessmentId = formIdForStage(enrollment.training_plan, stage);
        if (assessmentId === null) return null;

        const submissions = await db().assessment_submission.findMany({
          where: {
            enrollment_id: enrollment.enrollment_id,
            assessment_id: assessmentId,
            assessment_stage: stage,
            // Every attempt that was actually handed in, released or not. An attempt still waiting
            // on HRD is one the person sat and remembers sitting; leaving it out made the count
            // disagree with their own memory. What it may SAY about itself is limited below.
            submitted_at: { not: null },
          },
          orderBy: { attempt_no: "desc" },
          select: {
            submission_id: true,
            attempt_no: true,
            submitted_at: true,
            score: true,
            pass_status: true,
            publication_status: true,
            assessment: {
              select: {
                passing_score_percent: true,
                assessment_question: {
                  orderBy: { question_order: "asc" },
                  select: { question_id: true, question_order: true, question_text: true, question_score: true, question_type: true },
                },
              },
            },
            assessment_answer: {
              select: { question_id: true, score_awarded: true, review_comment: true, review_status: true },
            },
          },
        });
        if (submissions.length === 0) return null;

        /**
         * What one attempt scored, split into the part this system marked by itself and the part a
         * person still has to read.
         *
         * The auto-marked part is the whole point of showing an unreleased attempt at all: it tells
         * somebody how far the questions with a right answer got them, so they can see whether
         * another go is worth it without waiting on the written marking. It is honest to show early
         * because nothing about it can change - a matched answer is matched.
         */
        const totalsOf = (row: (typeof submissions)[number]) => {
          const awarded = new Map<string, Prisma.Decimal>();
          const pending = new Set<string>();
          for (const answer of row.assessment_answer) {
            const questionId = answer.question_id.toString();
            awarded.set(
              questionId,
              (awarded.get(questionId) ?? new Prisma.Decimal(0)).add(answer.score_awarded ?? new Prisma.Decimal(0)),
            );
            if (answer.review_status === "PENDING_REVIEW") pending.add(questionId);
          }
          let totalAwarded = new Prisma.Decimal(0);
          let totalPossible = new Prisma.Decimal(0);
          let autoAwarded = new Prisma.Decimal(0);
          let autoPossible = new Prisma.Decimal(0);
          let writtenPendingScore = new Prisma.Decimal(0);
          for (const question of row.assessment.assessment_question) {
            if (isFormBlockType(question.question_type)) continue;
            const questionId = question.question_id.toString();
            const questionAwarded = awarded.get(questionId) ?? new Prisma.Decimal(0);
            totalAwarded = totalAwarded.add(questionAwarded);
            totalPossible = totalPossible.add(question.question_score);
            // A written answer is the only kind a person has to mark, so it is the only kind whose
            // score can still move.
            if (question.question_type === "SHORT_ANSWER") {
              if (pending.has(questionId)) writtenPendingScore = writtenPendingScore.add(question.question_score);
            } else {
              autoAwarded = autoAwarded.add(questionAwarded);
              autoPossible = autoPossible.add(question.question_score);
            }
          }
          return {
            totalAwarded: Number(totalAwarded),
            totalPossible: Number(totalPossible),
            autoAwarded: Number(autoAwarded),
            autoPossible: Number(autoPossible),
            writtenPendingScore: Number(writtenPendingScore),
          };
        };

        const attempts: AssessmentReview["attempts"] = submissions.map((row) => {
          const totals = totalsOf(row);
          const released = row.publication_status === "PUBLISHED";
          return {
            submissionId: row.submission_id.toString(),
            attemptNo: row.attempt_no,
            submittedAt: row.submitted_at?.toISOString() ?? null,
            resultsPublished: released,
            // The final score and verdict stay behind the release gate. The auto-marked part does
            // not: it is already decided, and hiding it is what left people guessing.
            //
            // Worked out from the marks rather than read from `score`, which is a MARK now: reading
            // it as a percentage put "6%" beside "6 / 6" on the employee's own screen.
            scorePercent: released ? percentOfMarks(totals.totalAwarded, totals.totalPossible) : null,
            passStatus: released ? (row.pass_status as AssessmentReview["passStatus"]) : "PENDING",
            totalAwarded: released ? totals.totalAwarded : null,
            totalPossible: totals.totalPossible,
            autoAwarded: totals.autoAwarded,
            autoPossible: totals.autoPossible,
            writtenPendingScore: totals.writtenPendingScore,
          };
        });

        // Best of the released attempts, since only those have a final score to compare. With none
        // released yet, the auto-marked part is the only comparable thing there is. A tie goes to
        // the earlier attempt, which got there first.
        const released = attempts.filter((attempt) => attempt.resultsPublished);
        const best = (released.length > 0 ? [...released] : [...attempts]).sort((a, b) =>
          released.length > 0
            ? (b.scorePercent ?? -1) - (a.scorePercent ?? -1) || a.attemptNo - b.attemptNo
            : b.autoAwarded - a.autoAwarded || a.attemptNo - b.attemptNo,
        )[0];
        const submission =
          submissions.find((row) => row.attempt_no === (attemptNo ?? best.attemptNo)) ??
          submissions.find((row) => row.attempt_no === best.attemptNo)!;
        const openedIsReleased = submission.publication_status === "PUBLISHED";

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
          // A section break or text block is not a question: it has no answer and no marks, so it
          // belongs in neither the total nor the missed list.
          if (isFormBlockType(question.question_type)) continue;
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

        const openedTotals = totalsOf(submission);

        return {
          submissionId: submission.submission_id.toString(),
          attemptNo: submission.attempt_no,
          submittedAt: submission.submitted_at?.toISOString() ?? null,
          resultsPublished: openedIsReleased,
          scorePercent: openedIsReleased ? percentOfMarks(Number(totalAwarded), Number(totalPossible)) : null,
          passStatus: openedIsReleased ? (submission.pass_status as AssessmentReview["passStatus"]) : "PENDING",
          passingScorePercent: Number(submission.assessment.passing_score_percent),
          totalAwarded: openedIsReleased ? Number(totalAwarded) : null,
          totalPossible: Number(totalPossible),
          autoAwarded: openedTotals.autoAwarded,
          autoPossible: openedTotals.autoPossible,
          writtenPendingScore: openedTotals.writtenPendingScore,
          // The per-question breakdown is the released view. Handing it over early would show which
          // written answers scored what before HRD has decided, and the missed list on an unmarked
          // paper reads as "wrong" for answers nobody has read.
          missedQuestions: openedIsReleased ? missedQuestions : [],
          attempts,
          bestAttemptNo: best.attemptNo,
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
                assessment_choice: {
                  orderBy: { choice_order: "asc" as const },
                  // Ordered because a grid's answer key names its correct columns by choice_order.
                  select: {
                    choice_id: true,
                    is_correct: true,
                    axis: true,
                    option_score: true,
                    correct_columns: true,
                  },
                },
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
            // Sections and text blocks are not answerable. Skipping them before anything else also
            // keeps them out of the choice branch below, where a row with no choices would compare
            // an empty correct set against an empty submitted set, score as correct, and award its
            // question_score for nothing.
            if (isFormBlockType(question.question_type)) continue;
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

            if (isGridType(question.question_type)) {
              // Google Forms scores a grid per ROW: each row has its own points and its own correct
              // column(s), and a row earns its points only on an exact match. question_score is the
              // sum of the row points, so the denominator added above is already right.
              const rows = question.assessment_choice.filter((c) => c.axis === "ROW");
              const columns = question.assessment_choice.filter((c) => c.axis === "COLUMN");
              const columnOrderById = new Map(columns.map((c, index) => [c.choice_id.toString(), index + 1]));
              const submittedByRow = new Map((answer.grid ?? []).map((row) => [row.rowId, row.columnIds]));

              for (const row of rows) {
                const rowId = row.choice_id.toString();
                const picked = (submittedByRow.get(rowId) ?? []).filter((id) => columnOrderById.has(id));
                const rowCorrect = isGridRowCorrect(
                  parseCorrectColumns(row.correct_columns),
                  picked.map((id) => columnOrderById.get(id)!),
                );
                const rowAwarded = rowCorrect ? row.option_score : new Prisma.Decimal(0);
                totalAwarded = totalAwarded.add(rowAwarded);

                // Same "whole award on the first row" rule the choice branch uses, applied per grid
                // row, so a regrade summing score_awarded cannot multiply a row by its tick count.
                picked.forEach((columnId, index) => {
                  answerRows.push({
                    submission_id: BigInt(0),
                    question_id: BigInt(questionId),
                    choice_id: BigInt(columnId),
                    row_choice_id: BigInt(rowId),
                    is_correct: rowCorrect,
                    score_awarded: index === 0 ? rowAwarded : new Prisma.Decimal(0),
                    review_status: "NOT_REQUIRED",
                  });
                });
              }
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

          // The mark is what is stored. The pass mark is a percentage, so the comparison converts -
          // the score does not.
          const marks = hasPendingReview || totalPossible.isZero() ? null : totalAwarded;
          const passStatus = marks === null
            ? "PENDING"
            : marks.mul(100).div(totalPossible).gte(questions.passing_score_percent)
              ? "PASS"
              : "FAIL";

          const created = await tx.assessment_submission.create({
            data: {
              enrollment_id: enrollment.enrollment_id,
              assessment_id: assessmentId,
              assessment_stage: stage,
              attempt_no: previousAttempts + 1,
              submitted_at: new Date(),
              score: marks,
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

    /**
     * The evaluations this supervisor has been asked to fill in about other people. Their own
     * training never appears here - this list is only ever about somebody else.
     *
     * Only the 30-day follow-up. That stage asks what changed in the person since the course, which
     * is the supervisor's to answer; the after-training evaluation is the attendee's own verdict on
     * the course and stays theirs alone.
     */
    async listAssignedEvaluations(reviewerUserId: string): Promise<AssignedEvaluation[]> {
      return withDatabaseErrorMapping(async () => {
        const assignments = await db().training_evaluation_reviewer.findMany({
          where: { reviewer_user_id: reviewerUserId },
          include: {
            training_enrollment: {
              include: {
                training_plan: { include: planWithCourseInclude },
                employee: { select: { employee_code: true, first_name_th: true, last_name_th: true } },
                evaluation_submission: {
                  where: { respondent_user_id: reviewerUserId },
                  select: { evaluation_form_id: true, submitted_at: true },
                },
              },
            },
          },
          orderBy: { assigned_at: "desc" },
        });

        const now = new Date();
        const rows: AssignedEvaluation[] = [];
        for (const assignment of assignments) {
          const enrollment = assignment.training_enrollment;
          // Same rule the attendee's own forms follow: an unapproved registration is not a training
          // anyone should be evaluating yet.
          if (enrollment.approval_status !== "APPROVED") continue;
          const plan = enrollment.training_plan;
          const startAt = plan.start_datetime.toISOString();
          const endAt = plan.end_datetime.toISOString();

          const stage = "EVALUATION_30DAY" as const;
          const formId = formIdForStage(plan, stage);
          const link =
            plan.evaluation_after_30day_link ?? plan.training_plan_oap.course.evaluation_after_30day_link;
          // Neither a form nor a link means this course has no follow-up to fill in.
          if (formId === null && !link?.trim()) continue;

          const availability = stageAvailability(stage, startAt, endAt, null, now);
          rows.push({
            enrollmentId: enrollment.enrollment_id.toString(),
            stage,
            attendeeName: `${enrollment.employee.first_name_th} ${enrollment.employee.last_name_th}`.trim(),
            attendeeEmployeeCode: enrollment.employee.employee_code ?? "",
            courseName: plan.training_plan_oap.course_name_snapshot,
            batchName: plan.batch_name,
            startAt,
            endAt,
            mode: formId === null ? "LINK" : "FORM",
            link: formId === null ? link?.trim() ?? null : null,
            opensAt: availability.opensAt,
            isOpen: availability.state === "OPEN",
            openedAt: assignment.opened_at?.toISOString() ?? null,
            submitted:
              formId !== null &&
              enrollment.evaluation_submission.some(
                (submission) => submission.evaluation_form_id === formId && submission.submitted_at !== null,
              ),
          });
        }
        return rows;
      });
    },

    /**
     * Records that the supervisor followed an external evaluation link. For a LINK course this is
     * the only trace that will ever exist, since the answers live on somebody else's form - which
     * is why the screen calls it "opened" and never "done".
     *
     * A no-op unless the caller is the person actually assigned, and only the first open is kept.
     */
    async markAssignedEvaluationOpened(enrollmentId: string, reviewerUserId: string) {
      return withDatabaseErrorMapping(async () => {
        await db().training_evaluation_reviewer.updateMany({
          where: {
            enrollment_id: BigInt(enrollmentId),
            reviewer_user_id: reviewerUserId,
            opened_at: null,
          },
          data: { opened_at: new Date() },
        });
        return { opened: true as const };
      });
    },

    async readEvaluationForEmployee(
      enrollmentId: string,
      timing: "EVALUATION" | "EVALUATION_30DAY",
      employeeId: string | null,
      employeeUserId: string | null,
    ): Promise<EvaluationForEmployee> {
      return withDatabaseErrorMapping(async () => {
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId, timing === "EVALUATION_30DAY");
        const respondentUserId = respondentUserIdOf(enrollment, employeeUserId);
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
        await markReviewerOpened(db(), enrollment, respondentUserId);
        // Before the form is read, so the clock starts when the questions reach the screen.
        await markEvaluationStarted(db(), formId, enrollment.enrollment_id, respondentUserId);

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
                  question_description: true,
                  next_section: true,
                  is_required: true,
                  evaluation_option: {
                    orderBy: { option_order: "asc" },
                    select: {
                      evaluation_option_id: true,
                      option_order: true,
                      option_text: true,
                      next_section: true,
                      axis: true,
                    },
                  },
                },
              },
            },
          }),
          db().evaluation_submission.findUnique({
            where: submissionKey(formId, enrollment.enrollment_id, respondentUserId),
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
            questionDescription: question.question_description,
            nextSection: question.next_section,
            isRequired: question.is_required,
            options: question.evaluation_option.map((option) => ({
              optionId: option.evaluation_option_id.toString(),
              nextSection: option.next_section,
              axis: option.axis as EvaluationForEmployee["questions"][number]["options"][number]["axis"],
              optionOrder: option.option_order,
              optionText: option.option_text,
            })),
          })),
          // The row exists from the moment the form was opened, so only the submission time can say
          // whether it was answered.
          alreadySubmitted: existing?.submitted_at != null,
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
        const enrollment = await loadOwnedEnrollment(db(), enrollmentId, employeeId, employeeUserId, timing === "EVALUATION_30DAY");
        const respondentUserId = respondentUserIdOf(enrollment, employeeUserId);
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
          where: submissionKey(formId, enrollment.enrollment_id, respondentUserId),
          select: { evaluation_submission_id: true, submitted_at: true },
        });
        // The row itself is no longer the answer: opening the form makes one. Only a submission time
        // means this person has already had their say.
        if (existing?.submitted_at != null) {
          throw new ApiError({ code: "ALREADY_SUBMITTED", message: "This evaluation has already been submitted", status: 409 });
        }

        await db().$transaction(async (tx) => {
          const now = new Date();
          // The unfinished row from opening the form is the one being completed, and its `started_at`
          // is the whole point - it must not be overwritten here. A row is still created for the
          // paths that never passed through the form screen: an older reply, or an external link.
          const created = existing
            ? await tx.evaluation_submission.update({
                where: { evaluation_submission_id: existing.evaluation_submission_id },
                data: { status: "SUBMITTED", submitted_at: now },
              })
            : await tx.evaluation_submission.create({
                data: {
                  evaluation_form_id: formId,
                  enrollment_id: enrollment.enrollment_id,
                  respondent_user_id: respondentUserId,
                  status: "SUBMITTED",
                  started_at: now,
                  submitted_at: now,
                },
              });

          const rows: Prisma.evaluation_answerCreateManyInput[] = [];
          for (const answer of input.answers) {
            // A grid answer is one row per (row, column) pair - a column id alone cannot say which
            // row it was picked for, which is exactly why row_option_id exists.
            //
            // This MUST stay ahead of the empty-optionIds branch below: a grid carries its picks in
            // `grid` and leaves optionIds empty, so checking optionIds first swallowed every grid
            // answer into the rating/text branch and discarded it.
            if (answer.grid?.length) {
              for (const gridRow of answer.grid) {
                for (const columnId of gridRow.columnIds) {
                  rows.push({
                    evaluation_submission_id: created.evaluation_submission_id,
                    evaluation_question_id: BigInt(answer.questionId),
                    evaluation_option_id: BigInt(columnId),
                    row_option_id: BigInt(gridRow.rowId),
                    rating_value: null,
                    answer_text: null,
                  });
                }
              }
              continue;
            }
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
      respondentGroup: EvaluationRespondentGroup = "EMPLOYEE",
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
                  select: { evaluation_option_id: true, option_text: true, axis: true },
                },
              },
            },
          },
        });

        // Who was expected to answer. For the class it is the roster; for supervisors it is however
        // many of them HRD actually asked, which is usually far fewer - dividing their replies by
        // the roster would report a fraction of the response rate they really achieved.
        const expectedCount =
          respondentGroup === "EMPLOYEE"
            ? await db().training_enrollment.count({ where: { plan_id: BigInt(planId) } })
            : await db().training_evaluation_reviewer.count({
                where: { training_enrollment: { plan_id: BigInt(planId) } },
              });

        const allSubmissions = await db().evaluation_submission.findMany({
          where: {
            evaluation_form_id: formId,
            submitted_at: { not: null },
            training_enrollment: { plan_id: BigInt(planId) },
          },
          select: {
            evaluation_submission_id: true,
            // The two ends of "how long did this take", for the average on the results screen.
            started_at: true,
            submitted_at: true,
            // Which of the two audiences this row belongs to is "did the person who answered attend
            // the course themselves". SQL Server cannot compare two columns from inside a Prisma
            // filter, so the split happens here, over rows this query already had to load.
            respondent_user_id: true,
            training_enrollment: { select: { employee_user_id: true } },
            evaluation_answer: {
              select: {
                evaluation_question_id: true,
                evaluation_option_id: true,
                // Without the row link a grid answer cannot be told apart from an ordinary option
                // pick, which is what collapsed every grid into a flat column count.
                row_option_id: true,
                rating_value: true,
                answer_text: true,
              },
            },
          },
        });

        const submissions = allSubmissions.filter((submission) => {
          const isAttendeesOwn =
            submission.respondent_user_id === submission.training_enrollment.employee_user_id;
          return respondentGroup === "EMPLOYEE" ? isAttendeesOwn : !isAttendeesOwn;
        });

        const submittedCount = submissions.length;
        const enoughForFreeText = submittedCount >= FREE_TEXT_MIN_RESPONDENTS;

        /**
         * How long the replies took, on average.
         *
         * Two kinds of row are left out rather than averaged in. Replies from before the form
         * recorded an opening time have `started_at` equal to `submitted_at`, and counting those
         * zeroes would report a course answered in no time at all. At the other end, somebody who
         * opens the form and comes back after lunch is not evidence about the form, so anything
         * past ANSWER_TIME_CAP_SECONDS is dropped too.
         *
         * With nothing left to average the answer is null, and the screen says so rather than
         * showing a zero it cannot defend.
         */
        const durations = submissions
          .map((submission) => {
            const startedAt = submission.started_at ?? null;
            const submittedAt = submission.submitted_at ?? null;
            if (startedAt === null || submittedAt === null) return 0;
            return Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);
          })
          .filter((seconds) => seconds > 0 && seconds <= ANSWER_TIME_CAP_SECONDS);
        const averageAnswerSeconds =
          durations.length === 0
            ? null
            : Math.round(durations.reduce((total, seconds) => total + seconds, 0) / durations.length);

        // Which companies the replies came from. A count per company, never a person: this is the
        // same projection the anonymous screens read, so it may carry no identities.
        const respondentsByCompany: EvaluationSummary["respondentsByCompany"] = [];
        if (submittedCount > 0) {
          const employees = await db().employee.findMany({
            where: { user_id: { in: [...new Set(submissions.map((s) => s.respondent_user_id))] } },
            select: { user_id: true, company: { select: { company_code: true, company_name_th: true } } },
          });
          const companyOf = new Map(employees.map((employee) => [employee.user_id, employee.company]));
          const counts = new Map<string, { companyCode: string; companyName: string; count: number }>();
          for (const submission of submissions) {
            const company = companyOf.get(submission.respondent_user_id);
            // A reply from somebody with no company on their record still happened, and dropping it
            // would make the slices add up to less than the response count.
            const code = company?.company_code ?? "-";
            const entry = counts.get(code) ?? {
              companyCode: code,
              companyName: company?.company_name_th ?? "",
              count: 0,
            };
            entry.count += 1;
            counts.set(code, entry);
          }
          respondentsByCompany.push(
            ...[...counts.values()]
              .sort((a, b) => b.count - a.count || a.companyCode.localeCompare(b.companyCode))
              .map((entry) => ({ ...entry, percent: Math.round((entry.count / submittedCount) * 100) })),
          );
        }

        // Everything below counts PEOPLE. evaluation_answer holds one row per selected option, so
        // a three-tick MULTIPLE_CHOICE answer arrives as three rows from one respondent; a Set of
        // submission ids per bucket is what keeps that person counted once.
        const respondentsByQuestion = new Map<string, Set<bigint>>();
        const respondentsByOption = new Map<string, Set<bigint>>();
        // Grids are counted per (row, column) cell and per row. A grid answer stores one row per
        // picked cell, so counting by column alone would merge every row of the grid together.
        const respondentsByCell = new Map<string, Set<bigint>>();
        const respondentsByGridRow = new Map<string, Set<bigint>>();
        const cellKey = (rowId: string, columnId: string) => `${rowId}:${columnId}`;
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
              // `?? null` rather than a bare !== null: an answer row from before this column
              // existed, or from any caller that does not select it, arrives as undefined, and
              // treating that as "has a row" sends an ordinary option pick down the grid path.
              const rowOptionId = answer.row_option_id ?? null;
              if (rowOptionId !== null) {
                const rowId = rowOptionId.toString();
                addTo(respondentsByCell, cellKey(rowId, answer.evaluation_option_id.toString()), submission.evaluation_submission_id);
                addTo(respondentsByGridRow, rowId, submission.evaluation_submission_id);
              } else {
                addTo(respondentsByOption, answer.evaluation_option_id.toString(), submission.evaluation_submission_id);
              }
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
          respondentGroup,
          expectedCount,
          submittedCount,
          responseRatePercent: percent(submittedCount, expectedCount),
          averageAnswerSeconds,
          course: {
            planCode: plan.plan_code,
            courseName: plan.training_plan_oap.course_name_snapshot,
            batchName: plan.batch_name,
            startAt: plan.start_datetime.toISOString(),
            endAt: plan.end_datetime.toISOString(),
            venue: plan.venue,
            instructor: plan.training_plan_oap.instructor_name_text,
            // A plan under a company OAP belongs to that factory; otherwise the centre ran it.
            organiser: plan.training_plan_oap.company_id === null ? ("CENTER" as const) : ("FACTORY" as const),
          },
          respondentsByCompany,
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
              // A grid's rows and columns live in this same list but are not options, so they are
              // excluded here and reported through gridRows instead. `?? null` for the same reason
              // as the row link above: an option that predates the axis column reads as undefined,
              // and a bare === null would drop every ordinary option from the summary.
              options: question.evaluation_option.filter((option) => (option.axis ?? null) === null).map((option) => {
                const count = respondentsByOption.get(option.evaluation_option_id.toString())?.size ?? 0;
                return {
                  optionId: option.evaluation_option_id.toString(),
                  optionText: option.option_text,
                  count,
                  percent: percent(count, answeredBy),
                };
              }),
              gridRows: question.evaluation_option
                .filter((option) => option.axis === "ROW")
                .map((row) => {
                  const rowId = row.evaluation_option_id.toString();
                  // Denominator is the people who answered THIS row, matching how an ordinary
                  // question's option percentages are a share of that question's respondents.
                  // Rows are answered independently, so one row can trail the rest of the grid.
                  const rowAnsweredBy = respondentsByGridRow.get(rowId)?.size ?? 0;
                  return {
                    rowId,
                    rowText: row.option_text,
                    answeredBy: rowAnsweredBy,
                    cells: question.evaluation_option
                      .filter((option) => option.axis === "COLUMN")
                      .map((column) => {
                        const columnId = column.evaluation_option_id.toString();
                        const count = respondentsByCell.get(cellKey(rowId, columnId))?.size ?? 0;
                        return {
                          columnId,
                          columnText: column.option_text,
                          count,
                          percent: percent(count, rowAnsweredBy),
                        };
                      }),
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

    /**
     * The same answers readEvaluationSummary counts, but one paper at a time.
     *
     * The summary throws away who said what on purpose; this does not, which is the whole point of
     * it - HRD asked to read individual replies the way Microsoft Forms lets them. The anonymity
     * promise is kept the only way it can be on a screen like this: on an anonymous form the name
     * is dropped here, in the projection, so no screen can leak what never left the server. No
     * submission id and no user id travel either - a respondent is a position in the list.
     *
     * The order is the order they were submitted in. On an anonymous form that is still a thread a
     * determined reader could pull on if they also hold the attendance list, which is why the
     * summary's free-text rule exists; this screen is HRD's own and is not offered to anybody else.
     */
    async readEvaluationResponses(
      planId: string,
      timing: EvaluationTimingStage,
      companyId: string | null,
      respondentGroup: EvaluationRespondentGroup = "EMPLOYEE",
    ): Promise<EvaluationResponseList | null> {
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
            form_name: true,
            is_anonymous: true,
            evaluation_question: {
              orderBy: { question_order: "asc" },
              select: {
                evaluation_question_id: true,
                question_order: true,
                question_text: true,
                question_type: true,
                evaluation_option: {
                  orderBy: { option_order: "asc" },
                  select: { evaluation_option_id: true, option_text: true, axis: true },
                },
              },
            },
          },
        });

        const allSubmissions = await db().evaluation_submission.findMany({
          where: {
            evaluation_form_id: formId,
            submitted_at: { not: null },
            training_enrollment: { plan_id: BigInt(planId) },
          },
          orderBy: { submitted_at: "asc" },
          select: {
            started_at: true,
            submitted_at: true,
            respondent_user_id: true,
            // The attendee the reply is about, for a supervisor's 30-day answers: HRD reading those
            // needs to know which of their people each one describes.
            training_enrollment: {
              select: {
                employee_user_id: true,
                employee: { select: { title_th: true, first_name_th: true, last_name_th: true } },
              },
            },
            evaluation_answer: {
              select: {
                evaluation_question_id: true,
                evaluation_option_id: true,
                row_option_id: true,
                rating_value: true,
                answer_text: true,
              },
            },
          },
        });

        // Same split as the summary: which audience a row belongs to is "did the person who
        // answered attend the course themselves". SQL Server cannot compare two columns from inside
        // a Prisma filter, so it happens here, over rows this query already had to load.
        const submissions = allSubmissions.filter((submission) => {
          const isAttendeesOwn =
            submission.respondent_user_id === submission.training_enrollment.employee_user_id;
          return respondentGroup === "EMPLOYEE" ? isAttendeesOwn : !isAttendeesOwn;
        });

        // Names are looked up only when the form is not anonymous. On an anonymous form the query
        // is not run at all, so there is nothing to forget to strip later.
        const respondentsByUserId = new Map<
          string,
          { name: string; position: string | null; companyCode: string | null; employeeCode: string | null }
        >();
        if (!form.is_anonymous && submissions.length > 0) {
          const employees = await db().employee.findMany({
            where: { user_id: { in: [...new Set(submissions.map((s) => s.respondent_user_id))] } },
            select: {
              user_id: true,
              employee_code: true,
              title_th: true,
              first_name_th: true,
              last_name_th: true,
              position: { select: { position_name_th: true } },
              // The exported report groups the replies by company. It rides along on the query that
              // already runs rather than a second one, so an anonymous form still runs none.
              company: { select: { company_code: true } },
            },
          });
          for (const employee of employees) {
            respondentsByUserId.set(employee.user_id, {
              // The employee code is the fallback, and it too can be missing on an imported row.
              name: fullNameTh(employee) || employee.employee_code || "-",
              position: employee.position?.position_name_th ?? null,
              companyCode: employee.company?.company_code ?? null,
              employeeCode: employee.employee_code,
            });
          }
        }

        /**
         * The company, which an anonymous form carries too.
         *
         * HRD asked for it: the report groups replies by company, and a column of blanks made the
         * export useless on the anonymous forms they actually run. It is looked up on its own
         * query that selects nothing but the company code, so an anonymous form still never loads
         * a name - the promise that matters, and the one the test above this enforces.
         */
        const companyByUserId = new Map<string, string | null>();
        if (form.is_anonymous && submissions.length > 0) {
          const companies = await db().employee.findMany({
            where: { user_id: { in: [...new Set(submissions.map((s) => s.respondent_user_id))] } },
            select: { user_id: true, company: { select: { company_code: true } } },
          });
          for (const employee of companies) {
            companyByUserId.set(employee.user_id, employee.company?.company_code ?? null);
          }
        }

        const optionTextById = new Map<string, string>();
        for (const question of form.evaluation_question) {
          for (const option of question.evaluation_option) {
            optionTextById.set(option.evaluation_option_id.toString(), option.option_text);
          }
        }

        return {
          formName: form.form_name,
          isAnonymous: form.is_anonymous,
          timing,
          respondentGroup,
          questions: form.evaluation_question.map((question) => ({
            questionId: question.evaluation_question_id.toString(),
            questionOrder: question.question_order,
            questionText: question.question_text,
            questionType: question.question_type as EvaluationSummaryQuestion["questionType"],
          })),
          responses: submissions.map((submission, index) => {
            const byQuestion = new Map<string, EvaluationResponseAnswer>();
            for (const answer of submission.evaluation_answer) {
              const questionId = answer.evaluation_question_id.toString();
              const entry = byQuestion.get(questionId) ?? {
                questionId,
                choices: [],
                ratingValue: null,
                text: null,
              };
              if (answer.evaluation_option_id !== null) {
                const optionText = optionTextById.get(answer.evaluation_option_id.toString()) ?? "";
                // A grid answer is a (row, column) pair, and the column alone reads as an answer to
                // a question nobody asked. The row it belongs to is written in front of it.
                const rowText =
                  answer.row_option_id === null
                    ? null
                    : optionTextById.get(answer.row_option_id.toString()) ?? null;
                entry.choices.push(rowText === null ? optionText : `${rowText}: ${optionText}`);
              }
              // Decimal comes back as an object, like every other numeric column here.
              if (answer.rating_value !== null) entry.ratingValue = Number(answer.rating_value);
              if (answer.answer_text !== null && answer.answer_text.trim().length > 0) {
                entry.text = answer.answer_text;
              }
              byQuestion.set(questionId, entry);
            }

            const respondent = form.is_anonymous
              ? null
              : respondentsByUserId.get(submission.respondent_user_id) ?? null;
            // Only a reply written by somebody else is ABOUT somebody: an attendee's own answer has
            // no separate subject to name.
            const answeredBySomebodyElse =
              submission.respondent_user_id !== submission.training_enrollment.employee_user_id;

            return {
              responseNo: index + 1,
              respondentName: respondent?.name ?? null,
              respondentPosition: respondent?.position ?? null,
              companyCode:
                respondent?.companyCode ?? companyByUserId.get(submission.respondent_user_id) ?? null,
              employeeCode: respondent?.employeeCode ?? null,
              startedAt: submission.started_at?.toISOString() ?? null,
              subjectName:
                form.is_anonymous || !answeredBySomebodyElse
                  ? null
                  : fullNameTh(submission.training_enrollment.employee) || null,
              submittedAt: submission.submitted_at?.toISOString() ?? null,
              answers: [...byQuestion.values()],
            };
          }),
        };
      });
    },

    /** Everything on one plan still waiting on HRD: submissions with an ungraded SHORT_ANSWER, and
     *  submissions already graded but not yet released to the employee. HRD_FACTORY only ever sees
     *  plans their own company owns. */
    /**
     * One submitted paper, marked up, for HRD: every question with the answer key, what the person
     * picked, and what each answer scored.
     *
     * Separate from readAssessmentReviewForEmployee, which answers the same question for the person
     * who sat the test and deliberately carries no key. Two audiences, two shapes: a screen written
     * for the employee has nowhere to put a key even by mistake.
     */
    async readSubmissionForHrd(
      planId: string,
      submissionId: string,
      companyId: string | null,
    ): Promise<SubmissionReview> {
      return withDatabaseErrorMapping(async () => {
        const submission = await db().assessment_submission.findUniqueOrThrow({
          where: { submission_id: BigInt(submissionId) },
          include: {
            training_enrollment: {
              select: {
                enrollment_id: true,
                plan_id: true,
                employee: {
                  select: { employee_code: true, first_name_th: true, last_name_th: true, first_name_en: true, last_name_en: true },
                },
                training_plan: { select: { training_plan_oap: { select: { company_id: true } } } },
              },
            },
            assessment: {
              select: {
                passing_score_percent: true,
                assessment_question: {
                  orderBy: { question_order: "asc" },
                  select: {
                    question_id: true,
                    question_order: true,
                    question_text: true,
                    question_type: true,
                    question_score: true,
                    assessment_choice: {
                      orderBy: { choice_order: "asc" },
                      select: { choice_id: true, choice_order: true, choice_text: true, is_correct: true, axis: true },
                    },
                  },
                },
              },
            },
            assessment_answer: {
              select: {
                answer_id: true,
                question_id: true,
                choice_id: true,
                row_choice_id: true,
                answer_text: true,
                is_correct: true,
                score_awarded: true,
                review_status: true,
                review_comment: true,
              },
            },
          },
        });

        // The plan in the URL has to be the submission's own, or a scoped HRD user could read a
        // paper from another company by pairing their own plan id with somebody else's submission.
        if (submission.training_enrollment.plan_id.toString() !== planId) {
          throw notFound("This submission does not belong to that plan");
        }
        if (
          companyId &&
          submission.training_enrollment.training_plan.training_plan_oap.company_id?.toString() !== companyId
        ) {
          throw forbidden("This training plan is outside your permitted scope");
        }

        const employee = submission.training_enrollment.employee;
        const answersByQuestion = new Map<string, typeof submission.assessment_answer>();
        for (const answer of submission.assessment_answer) {
          const key = answer.question_id.toString();
          const bucket = answersByQuestion.get(key);
          if (bucket) bucket.push(answer);
          else answersByQuestion.set(key, [answer]);
        }

        let totalScore = 0;
        let scoreAwarded = 0;
        const questions = submission.assessment.assessment_question.map((question) => {
          const questionId = question.question_id.toString();
          const answers = answersByQuestion.get(questionId) ?? [];
          const picked = new Set(answers.map((answer) => answer.choice_id?.toString()).filter(Boolean));
          const written = answers.find((answer) => answer.choice_id === null);
          const awarded = answers.reduce(
            (sum, answer) => sum + (answer.score_awarded === null ? 0 : Number(answer.score_awarded)),
            0,
          );
          const hasScore = answers.some((answer) => answer.score_awarded !== null);
          // A block carries no marks and is not part of the total - the same rule the grading and
          // submitting paths already apply, kept in step here so the denominators agree.
          if (!isFormBlockType(question.question_type)) totalScore += Number(question.question_score);
          scoreAwarded += awarded;

          return {
            questionId,
            questionOrder: question.question_order,
            questionText: question.question_text,
            questionType: question.question_type,
            questionScore: Number(question.question_score),
            scoreAwarded: hasScore ? awarded : null,
            // A written answer is a judgement, not a match, so it has no true/false of its own -
            // saying "wrong" for one nobody has read yet would be the screen inventing a verdict.
            isCorrect: written ? null : answers.some((answer) => answer.is_correct === true),
            needsReview: answers.some((answer) => answer.review_status === "PENDING_REVIEW"),
            answerId: written?.answer_id.toString() ?? null,
            answerText: written?.answer_text ?? null,
            reviewComment: written?.review_comment ?? null,
            choices: question.assessment_choice.map((choice) => ({
              choiceId: choice.choice_id.toString(),
              choiceOrder: choice.choice_order,
              choiceText: choice.choice_text,
              isCorrect: choice.is_correct,
              picked: picked.has(choice.choice_id.toString()),
              pickedRowIds: answers
                .filter((answer) => answer.choice_id === choice.choice_id && answer.row_choice_id !== null)
                .map((answer) => answer.row_choice_id!.toString()),
              axis: (choice.axis as "ROW" | "COLUMN" | null) ?? null,
            })),
          };
        });

        return {
          submissionId: submission.submission_id.toString(),
          enrollmentId: submission.training_enrollment.enrollment_id.toString(),
          employeeName:
            `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
            `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim(),
          employeeCode: employee.employee_code ?? "",
          stage: submission.assessment_stage as GradedStage,
          attemptNo: submission.attempt_no,
          submittedAt: submission.submitted_at?.toISOString() ?? null,
          totalScore,
          scoreAwarded,
          passingScorePercent: Number(submission.assessment.passing_score_percent),
          passStatus: submission.pass_status as SubmissionReview["passStatus"],
          gradingStatus: submission.grading_status as SubmissionReview["gradingStatus"],
          resultsPublished: submission.publication_status === "PUBLISHED",
          questions,
        };
      });
    },

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
            assessment: { select: { passing_score_percent: true, assessment_question: { select: { question_id: true, question_score: true, question_type: true } } } },
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
            if (isFormBlockType(question.question_type)) continue;
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
          const passStatus =
            !totalPossible.isZero() &&
            totalAwarded.mul(100).div(totalPossible).gte(submission.assessment.passing_score_percent)
              ? "PASS"
              : "FAIL";

          await tx.assessment_submission.update({
            where: { submission_id: submission.submission_id },
            data: { score: totalAwarded, pass_status: passStatus, status: "GRADED", grading_status: "REVIEWED" },
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
    // Every attempt at one stage is against the same assessment, so the highest mark is the highest
    // score however it is expressed.
    orderBy: [{ score: "desc" }, { submitted_at: "desc" }],
    select: { submission_id: true, score: true },
  });
  if (!best) return;

  // Marks only. The marks this is out of are the assessment's own question totals, reachable
  // through official_*_submission_id and unable to change once anybody has answered - so copying
  // them onto this row would store the same fact twice. The pre/post_link_score_max columns exist
  // for the case that has no assessment at all: a test this system cannot see.
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
