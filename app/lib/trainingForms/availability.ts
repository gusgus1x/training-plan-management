/**
 * When each stage of an employee's training-form pipeline opens (and, for the two stages that can
 * be closed, whether HRD has closed it). Kept free of every import so both sides can use it: the
 * repository enforces this against the database, and the employee screens run the same rule against
 * data they already have in memory - the same pattern as ../courses/prerequisiteGraph.ts.
 *
 * Opening dates are computed from the plan, not stored: pre-test, post-test and the after-training
 * evaluation open the moment the course starts; the 30-day follow-up evaluation opens
 * FOLLOW_UP_OPENS_AFTER_DAYS days after the course ends.
 *
 * Closing is HRD-controlled, but only for PRE_TEST and POST_TEST - training_plan_assessment_setting
 * only exists to carry those two (CK_RC2_training_plan_assessment_setting_assessment_stage_enum
 * accepts nothing else, confirmed against the live database 2026-09-01). The two evaluation stages
 * cannot be closed at all: evaluation_submission carries
 * UNIQUE(evaluation_form_id, enrollment_id), so a submitted evaluation is already un-repeatable by
 * the database itself, and the user confirmed a close switch would add nothing.
 */

export const FOLLOW_UP_OPENS_AFTER_DAYS = 25;

export type FormStageKey = "PRE_TEST" | "POST_TEST" | "EVALUATION" | "EVALUATION_30DAY";

/** The two stages HRD can close. The other two accept a closedAt argument that is simply ignored. */
export const CLOSABLE_STAGES: readonly FormStageKey[] = ["PRE_TEST", "POST_TEST"];

export type StageAvailabilityState = "NOT_YET" | "OPEN" | "CLOSED_BY_HRD";

export type StageAvailability = {
  state: StageAvailabilityState;
  opensAt: string;
};

/** ISO datetime string this stage opens at, given the plan's own start/end. */
export const stageOpensAt = (stage: FormStageKey, startAt: string, endAt: string): string => {
  if (stage === "EVALUATION_30DAY") {
    const end = new Date(endAt);
    end.setUTCDate(end.getUTCDate() + FOLLOW_UP_OPENS_AFTER_DAYS);
    return end.toISOString();
  }
  return startAt;
};

/**
 * Whether a stage can be acted on right now. `closedAt` only has an effect for PRE_TEST/POST_TEST -
 * passing it for either evaluation stage changes nothing, since HRD has no close switch for those.
 */
export const stageAvailability = (
  stage: FormStageKey,
  startAt: string,
  endAt: string,
  closedAt: string | null,
  now: Date,
): StageAvailability => {
  const opensAt = stageOpensAt(stage, startAt, endAt);
  if (now.getTime() < new Date(opensAt).getTime()) {
    return { state: "NOT_YET", opensAt };
  }
  if (CLOSABLE_STAGES.includes(stage) && closedAt !== null) {
    return { state: "CLOSED_BY_HRD", opensAt };
  }
  return { state: "OPEN", opensAt };
};
