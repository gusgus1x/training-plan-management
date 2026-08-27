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
    } satisfies AssessmentWriteInput;
    await createAssessment(input, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/training-course/assessments",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("creates Pre Test and Post Test successfully with seriesCode", async () => {
    const preAssessment = { assessmentId: "101", seriesCode: "PRE-000001", seriesName: "Pre Test", purpose: "PRE_TEST" };
    const postAssessment = { assessmentId: "102", seriesCode: "POST-000001", seriesName: "Post Test", purpose: "POST_TEST" };

    const fetcher = vi.fn()
      .mockResolvedValueOnce(success({ assessment: preAssessment }, 201))
      .mockResolvedValueOnce(success({ assessment: postAssessment }, 201));

    const preInput: AssessmentWriteInput = {
      scope: "CENTRAL",
      companyId: null,
      seriesCode: "PRE-000001",
      seriesName: "Pre Test",
      purpose: "PRE_TEST",
      versionNote: null,
      instructions: "Pre Test instructions",
      passingScorePercent: "80.00",
      timeLimitMinutes: 30,
      status: "ACTIVE",
      questions: [],
    };

    const postInput: AssessmentWriteInput = {
      scope: "CENTRAL",
      companyId: null,
      seriesCode: "POST-000001",
      seriesName: "Post Test",
      purpose: "POST_TEST",
      versionNote: null,
      instructions: "Post Test instructions",
      passingScorePercent: "80.00",
      timeLimitMinutes: 30,
      status: "ACTIVE",
      questions: [],
    };

    await expect(createAssessment(preInput, fetcher)).resolves.toEqual({ assessment: preAssessment });
    await expect(createAssessment(postInput, fetcher)).resolves.toEqual({ assessment: postAssessment });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

