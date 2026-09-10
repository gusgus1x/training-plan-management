/**
 * When each stage of an employee's training-form pipeline opens (and, for the two stages that can
 * be closed, whether HRD has closed it). Kept free of every import so both sides can use it: the
 * repository enforces this against the database, and the employee screens run the same rule against
 * data they already have in memory - the same pattern as ../courses/prerequisiteGraph.ts.
 *
 * Opening dates are computed from the plan, not stored: pre-test, post-test and the after-training
 * evaluation open the moment the course starts; the 30-day follow-up evaluation opens
 * FOLLOW_UP_OPENS_AFTER_DAYS days after the course ends. The dashboard reminder banner nags earlier,
 * from FOLLOW_UP_REMINDER_AFTER_DAYS, so employees see it coming before the form actually unlocks.
 *
 * Closing is HRD-controlled, but only for PRE_TEST and POST_TEST - training_plan_assessment_setting
 * only exists to carry those two (CK_RC2_training_plan_assessment_setting_assessment_stage_enum
 * accepts nothing else, confirmed against the live database 2026-09-01). The two evaluation stages
 * cannot be closed at all: evaluation_submission carries
 * UNIQUE(evaluation_form_id, enrollment_id), so a submitted evaluation is already un-repeatable by
 * the database itself, and the user confirmed a close switch would add nothing.
 */

export const FOLLOW_UP_OPENS_AFTER_DAYS = 30;

/** Days after the course ends that the dashboard reminder banner starts nagging - before the form
 *  itself opens (FOLLOW_UP_OPENS_AFTER_DAYS), so employees get a heads-up. */
export const FOLLOW_UP_REMINDER_AFTER_DAYS = 25;

/** ISO datetime the dashboard reminder banner should start showing for this enrollment. */
export const followUpReminderAt = (endAt: string): string => {
  const end = new Date(endAt);
  end.setUTCDate(end.getUTCDate() + FOLLOW_UP_REMINDER_AFTER_DAYS);
  return end.toISOString();
};

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
    // The start of that day, not the hour the course happened to finish on. Carrying the finishing
    // time forward made the form open at 16:00 for a course that ended at 16:00, while the screen
    // said only "opens 10 Sep" - so on the day itself it read as open and behaved as locked, with
    // nothing on screen to explain the wait. Thirty days is a rule about days.
    //
    // ponytail: midnight UTC, which is 07:00 in the only timezone this system runs in. A course
    // recorded as ending after 17:00 UTC falls on the next local day and would open a day late by
    // the label; store the plan's timezone if that ever becomes real.
    end.setUTCHours(0, 0, 0, 0);
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
