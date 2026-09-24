"use client";

import { useEffect, useRef } from "react";
import {
  REALTIME_RECONNECTED,
  REALTIME_WINDOW_EVENT,
  type RealtimeEvent,
  type RealtimeEventType,
} from "../lib/realtime/events";

const EVENT_TYPES: RealtimeEventType[] = [
  "notification.created",
  "enrollment.changed",
  "needRequest.changed",
  "recordRequest.changed",
  "plan.changed",
  "attendance.changed",
  "evaluation.submitted",
  "activity.changed",
  "session.changed",
  "session.revoked",
];

/** After the server refuses the stream (signed out, expired), try again this much later. */
const RETRY_AFTER_REFUSAL_MS = 60_000;

/**
 * One Server-Sent Events stream per tab, opened while someone is signed in. Every server event is
 * re-dispatched on `window`, where useRealtime picks it up; a drop and reconnect is announced too so
 * pages can catch up. `onRevoked` runs when the server ends the session.
 */
export default function RealtimeConnection({ onRevoked }: { onRevoked: () => void }) {
  const onRevokedRef = useRef(onRevoked);
  useEffect(() => {
    onRevokedRef.current = onRevoked;
  }, [onRevoked]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let dropped = false;
    let stopped = false;

    const connect = () => {
      source = new EventSource("/api/events", { withCredentials: true });
      source.onopen = () => {
        if (dropped) window.dispatchEvent(new Event(REALTIME_RECONNECTED));
        dropped = false;
      };
      source.onerror = () => {
        dropped = true;
        // A network drop reconnects on its own; a refused request (401) closes the source for good,
        // so try again later in case the person signs back in on another tab.
        if (source?.readyState === EventSource.CLOSED && !stopped) {
          source.close();
          retryTimer = window.setTimeout(connect, RETRY_AFTER_REFUSAL_MS);
        }
      };
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (message) => {
          let event: RealtimeEvent;
          try {
            event = JSON.parse((message as MessageEvent<string>).data) as RealtimeEvent;
          } catch {
            return;
          }
          if (event.type === "session.revoked") onRevokedRef.current();
          window.dispatchEvent(new CustomEvent<RealtimeEvent>(REALTIME_WINDOW_EVENT, { detail: event }));
        });
      }
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return null;
}
