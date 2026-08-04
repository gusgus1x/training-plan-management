import { describe, expect, it, vi } from "vitest";
import { createAssessment, listAssessments } from "../../app/lib/assessments/client";
import type { AssessmentWriteInput } from "../../app/lib/assessments/types";

const success = (data: unknown, status = 200) => new Response(
  JSON.stringify({ ok: true, data }),
  { status, headers: { "content-type": "application/json" } },
);

describe("assessment client", () => {
  it("uses the API-supported maximum page size", async () => {
    const fetcher = vi.fn().mockResolvedValue(success({ items: [] }));
    await listAssessments(undefined, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("pageSize=100"),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("pageSize=500");
  });

  it("returns the saved Assessment from POST for immediate UI update", async () => {
    const assessment = { assessmentId: "1", seriesCode: "ASM-003" };
    const fetcher = vi.fn().mockResolvedValue(success({ assessment }, 201));
    const input = {
      scope: "CENTRAL",
      companyId: null,
      seriesCode: "",
      seriesName: "Safety Test",
      purpose: "PRE_TEST",
      versionNote: null,
      instructions: null,
      passingScorePercent: "80",
      timeLimitMinutes: null,
      status: "DRAFT",
      questions: [],
    } satisfies AssessmentWriteInput;
    await expect(createAssessment(input, fetcher)).resolves.toEqual({ assessment });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/training-course/assessments",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
