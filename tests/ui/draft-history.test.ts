import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  COALESCE_MS,
  HISTORY_LIMIT,
  historyReducer,
  initialHistory,
  type DraftHistory,
} from "../../app/components/forms/draftHistory";
import { blankDraft, type FormDraft } from "../../app/components/forms/formDraft";

/**
 * Undo keeps whole drafts rather than edits, so the only things that can go wrong are the
 * bookkeeping: what counts as one step, what a new edit does to a redo that was waiting, and
 * whether the stack ever stops growing.
 */

const base = () => blankDraft("assessment", null, false);
const named = (name: string): FormDraft => ({ ...base(), name });

const edit = (history: DraftHistory, name: string, at: number, discrete = false) =>
  historyReducer(history, { type: "edit", draft: named(name), at, discrete });

describe("the builder's undo history", () => {
  it("steps back to what was there before", () => {
    let history = initialHistory(named("first"));
    history = edit(history, "second", 10_000);

    expect(canUndo(history)).toBe(true);
    history = historyReducer(history, { type: "undo" });
    expect(history.present?.name).toBe("first");

    expect(canRedo(history)).toBe(true);
    history = historyReducer(history, { type: "redo" });
    expect(history.present?.name).toBe("second");
  });

  it("treats quick typing as one step, not one per keystroke", () => {
    let history = initialHistory(named(""));
    history = edit(history, "a", 1_000);
    history = edit(history, "ab", 1_000 + COALESCE_MS / 2);
    history = edit(history, "abc", 1_000 + COALESCE_MS - 1);

    // One step back reaches what was there before the word was typed, not "ab".
    history = historyReducer(history, { type: "undo" });
    expect(history.present?.name).toBe("");
  });

  it("gives a structural change its own step however fast it lands", () => {
    let history = initialHistory(named("start"));
    history = edit(history, "typed", 1_000);
    history = edit(history, "card added", 1_050, true);

    history = historyReducer(history, { type: "undo" });
    expect(history.present?.name).toBe("typed");
  });

  it("drops the redo trail as soon as something new is done", () => {
    let history = initialHistory(named("first"));
    history = edit(history, "second", 10_000);
    history = historyReducer(history, { type: "undo" });
    history = edit(history, "another", 20_000);

    // "second" is gone: the history forked, and the branch nobody took does not linger.
    expect(canRedo(history)).toBe(false);
    expect(history.present?.name).toBe("another");
  });

  it("never lets an undo merge into the edit it just undid", () => {
    let history = initialHistory(named("first"));
    history = edit(history, "second", 10_000);
    history = historyReducer(history, { type: "undo" });
    // Immediately after an undo, even a fast edit starts a step of its own.
    history = edit(history, "third", 10_001);

    history = historyReducer(history, { type: "undo" });
    expect(history.present?.name).toBe("first");
  });

  it("stops growing, however long the afternoon is", () => {
    let history = initialHistory(named("0"));
    for (let step = 1; step <= HISTORY_LIMIT + 25; step += 1) {
      history = edit(history, String(step), step * 10_000, true);
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });

  it("starts over when another form is loaded", () => {
    let history = initialHistory(named("first"));
    history = edit(history, "second", 10_000);
    history = historyReducer(history, { type: "reset", draft: named("other form"), at: 20_000 });

    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(history.present?.name).toBe("other form");
  });
});

describe("a gesture that reports itself continuously, such as a drag", () => {
  /**
   * A drag fires on every pointer move. Writing each one into the history filled the stack with
   * states nobody could tell apart and left undo doing nothing visible several presses running.
   */
  it("moves the form without touching the history", () => {
    let history = initialHistory(named("first"));
    history = historyReducer(history, { type: "replace", draft: named("mid-drag") });
    history = historyReducer(history, { type: "replace", draft: named("still dragging") });

    expect(history.present?.name).toBe("still dragging");
    expect(canUndo(history)).toBe(false);
  });

  it("leaves one step behind when the gesture ends", () => {
    const before = named("first");
    let history = initialHistory(before);
    history = historyReducer(history, { type: "replace", draft: named("mid-drag") });
    history = historyReducer(history, { type: "replace", draft: named("dropped") });
    history = historyReducer(history, { type: "checkpoint", before, at: 10_000 });

    expect(history.past).toHaveLength(1);
    expect(history.present?.name).toBe("dropped");

    history = historyReducer(history, { type: "undo" });
    expect(history.present?.name).toBe("first");
  });

  it("leaves no step at all when the card is dropped where it started", () => {
    const before = named("first");
    const history = historyReducer(initialHistory(before), { type: "checkpoint", before, at: 10_000 });

    expect(canUndo(history)).toBe(false);
  });
});
