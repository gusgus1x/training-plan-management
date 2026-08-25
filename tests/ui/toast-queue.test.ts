import { describe, expect, it } from "vitest";
import {
  AUTO_DISMISS_MS,
  MAX_VISIBLE_TOASTS,
  addToast,
  removeToast,
  type Toast,
} from "../../app/lib/toastQueue";

const toast = (id: number): Toast => ({ id, variant: "success", message: `m${id}` });

describe("toast queue", () => {
  it("appends so the newest toast is last", () => {
    const result = addToast([toast(1)], toast(2));
    expect(result.map((item) => item.id)).toEqual([1, 2]);
  });

  it("drops the oldest once the stack is full", () => {
    const full = Array.from({ length: MAX_VISIBLE_TOASTS }, (_, index) => toast(index + 1));
    const result = addToast(full, toast(99));
    expect(result).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(result[0].id).toBe(2);
    expect(result.at(-1)?.id).toBe(99);
  });

  it("removes only the requested id and leaves the rest in order", () => {
    const result = removeToast([toast(1), toast(2), toast(3)], 2);
    expect(result.map((item) => item.id)).toEqual([1, 3]);
  });

  it("returns an equal-length list when the id is unknown", () => {
    const current = [toast(1)];
    expect(removeToast(current, 42)).toHaveLength(1);
  });

  it("keeps errors on screen until dismissed", () => {
    expect(AUTO_DISMISS_MS.error).toBeNull();
    expect(AUTO_DISMISS_MS.success).toBeGreaterThan(0);
  });
});
