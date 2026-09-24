"use client";

import { useEffect, useRef } from "react";
import {
  REALTIME_RECONNECTED,
  REALTIME_WINDOW_EVENT,
  type RealtimeEvent,
  type RealtimeEventType,
} from "../lib/realtime/events";

/** How far a broadcast (or everyone reconnecting after a server restart) is spread out. */
const SPREAD_MS = 5000;

type Options = {
  /** Only events for this batch (events without a planId always pass). */
  planId?: string | null;
  /** Collapse a burst (HRD sending 20 people) into one call this long after the last event. */
  debounceMs?: number;
};

/**
 * Calls `onChange` when the server says one of `types` changed, and once after the stream comes
 * back from a drop (anything could have changed meanwhile). `onChange` should refetch quietly -
 * without the page's full loading state - or the screen flickers on every change someone else makes.
 */
export function useRealtime(types: RealtimeEventType[], onChange: (event: RealtimeEvent | null) => void, options: Options = {}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const typesKey = types.join(",");
  const { planId = null, debounceMs = 0 } = options;

  useEffect(() => {
    const wanted = new Set(typesKey.split(","));
    let timer: number | undefined;
    let pending: RealtimeEvent | null = null;
    const fire = (event: RealtimeEvent | null, spread: boolean) => {
      // ponytail: fixed 0-5s spread; size it from the open-connection count if 5s stops being enough.
      const delay = debounceMs + (spread ? Math.random() * SPREAD_MS : 0);
      if (!delay) return onChangeRef.current(event);
      pending = event;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onChangeRef.current(pending), delay);
    };
    const onEvent = (raw: Event) => {
      const event = (raw as CustomEvent<RealtimeEvent>).detail;
      if (!event || !wanted.has(event.type)) return;
      const eventPlan = "planId" in event ? event.planId : undefined;
      if (planId && eventPlan && eventPlan !== planId) return;
      fire(event, Boolean(event.spread));
    };
    // After a server restart every tab reconnects at once, so catching up is spread out too.
    const onReconnect = () => fire(null, true);
    window.addEventListener(REALTIME_WINDOW_EVENT, onEvent);
    window.addEventListener(REALTIME_RECONNECTED, onReconnect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(REALTIME_WINDOW_EVENT, onEvent);
      window.removeEventListener(REALTIME_RECONNECTED, onReconnect);
    };
  }, [typesKey, planId, debounceMs]);
}
