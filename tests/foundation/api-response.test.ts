import { describe, expect, it } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import { apiFailure, apiSuccess } from "../../app/lib/api/response";

describe("common API response format", () => {
  it("formats successful responses", async () => {
    const response = apiSuccess({ status: "reachable" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { status: "reachable" },
    });
  });

  it("formats known errors with a stable request id", async () => {
    const response = apiFailure(
      new ApiError({
        code: "INVALID_INPUT",
        message: "Input is invalid",
        status: 400,
        details: { field: "name" },
      }),
      "request-123",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Input is invalid",
        requestId: "request-123",
        details: { field: "name" },
      },
    });
  });

  it("does not expose an unknown raw error", async () => {
    const response = apiFailure(
      new Error("password=secret; server=internal-host; SQL failed"),
      "request-456",
    );
    const body = await response.json();
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: "request-456",
      },
    });
    expect(serializedBody).not.toContain("secret");
    expect(serializedBody).not.toContain("internal-host");
    expect(serializedBody).not.toContain("SQL failed");
  });
});
