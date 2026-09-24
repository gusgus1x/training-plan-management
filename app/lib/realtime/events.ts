/**
 * What can change under an open page. Events carry ids only, never the data: whoever hears one
 * refetches through the API it already uses.
 */
export type RealtimeEvent = (
  | { type: "notification.created" }
  | { type: "enrollment.changed"; planId?: string }
  | { type: "needRequest.changed" }
  | { type: "recordRequest.changed" }
  | { type: "plan.changed"; planId?: string }
  | { type: "attendance.changed"; planId?: string }
  | { type: "evaluation.submitted"; planId?: string }
  | { type: "activity.changed" }
  | { type: "session.changed" }
  | { type: "session.revoked" }
) & {
  /** Set by the server on events sent to everyone: each tab waits a random moment before
   *  refetching, so a thousand open pages do not all hit the API in the same second. */
  spread?: boolean;
};

export type RealtimeEventType = RealtimeEvent["type"];

/** The browser-side event the connection re-dispatches each server event as. */
export const REALTIME_WINDOW_EVENT = "tpm-realtime";

/** Dispatched once the stream is back after a drop, so pages can catch up on what they missed. */
export const REALTIME_RECONNECTED = "tpm-realtime-reconnected";
