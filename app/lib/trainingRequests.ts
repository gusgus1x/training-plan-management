/**
 * Training need requests live in the database now, reached through
 * app/lib/trainingNeedRequests. What is left here is one same-tab handoff: after HRD approves a
 * request, the OAP form reads it to prefill a new course. That value is throwaway UI state which
 * dies with the tab - it is not where the request is stored.
 */
export const APPROVED_TRAINING_NEED_STORAGE_KEY = "training-plan.approved-training-need";
