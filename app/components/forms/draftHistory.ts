import type { FormDraft } from "./formDraft";

/**
 * Undo and redo for the form builder, as a value rather than as a pile of refs.
 *
 * What is stored is whole drafts, not edits. A form is small - a few dozen items - and keeping
 * snapshots means undo cannot disagree with the thing it is undoing, which is the failure mode of
 * every diff-based history somebody writes in an afternoon.
 *
 * Two rules keep it usable. Typing coalesces: an edit that lands within `COALESCE_MS` of the last
 * one replaces the top of the stack instead of stacking on it, so undo steps back by a word rather
 * than by a keystroke. And the stack is capped, because a long afternoon of editing should not
 * grow without end.
 */

export const COALESCE_MS = 600;
export const HISTORY_LIMIT = 60;

export type DraftHistory = {
  past: FormDraft[];
  present: FormDraft | null;
  future: FormDraft[];
  /** When the top of `past` was pushed, for the coalescing rule above. */
  lastPushAt: number;
};

export type HistoryAction =
  /** A fresh form arrived - loaded, or started blank. History starts over with it. */
  | { type: "reset"; draft: FormDraft; at: number }
  | { type: "edit"; draft: FormDraft; at: number; /** Never coalesce: a structural change is its own step. */ discrete?: boolean }
  /**
   * The form moves, the history does not. For a gesture that reports itself continuously - a drag
   * fires on every pointer move - where one step in the history is what the person actually did.
   */
  | { type: "replace"; draft: FormDraft }
  /** Closes such a gesture: `before` is how the form looked when it started. */
  | { type: "checkpoint"; before: FormDraft; at: number }
  | { type: "undo" }
  | { type: "redo" };

export const initialHistory = (draft: FormDraft | null): DraftHistory => ({
  past: [],
  present: draft,
  future: [],
  lastPushAt: 0,
});

export const canUndo = (history: DraftHistory) => history.past.length > 0;
export const canRedo = (history: DraftHistory) => history.future.length > 0;

export const historyReducer = (history: DraftHistory, action: HistoryAction): DraftHistory => {
  switch (action.type) {
    case "reset":
      return { past: [], present: action.draft, future: [], lastPushAt: action.at };

    case "edit": {
      if (history.present === null) {
        return { past: [], present: action.draft, future: [], lastPushAt: action.at };
      }
      // Typing quickly on one field is one step, not thirty. A structural change - adding a
      // question, deleting one, moving one - always gets its own, whatever the clock says.
      const coalesce =
        !action.discrete && history.past.length > 0 && action.at - history.lastPushAt < COALESCE_MS;
      const past = coalesce ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
      return { past, present: action.draft, future: [], lastPushAt: coalesce ? history.lastPushAt : action.at };
    }

    case "replace":
      return history.present === null ? history : { ...history, present: action.draft };

    case "checkpoint": {
      if (history.present === null || history.present === action.before) return history;
      return {
        past: [...history.past, action.before].slice(-HISTORY_LIMIT),
        present: history.present,
        future: [],
        lastPushAt: action.at,
      };
    }

    case "undo": {
      if (history.past.length === 0 || history.present === null) return history;
      const previous = history.past[history.past.length - 1];
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        // Zero, so the next edit after an undo always starts a new step rather than merging into
        // the one that was just undone.
        lastPushAt: 0,
      };
    }

    case "redo": {
      if (history.future.length === 0 || history.present === null) return history;
      const [next, ...rest] = history.future;
      return { past: [...history.past, history.present], present: next, future: rest, lastPushAt: 0 };
    }

    default:
      return history;
  }
};
