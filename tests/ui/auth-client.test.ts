import { describe, expect, it, vi } from "vitest";
import {
  getCurrentSession,
  loginWithCredentials,
  logoutCurrentSession,
} from "../../app/lib/auth/client";

const sessionBody = {
  ok: true,
  data: {
    user: {
      userId: "1",
      username: "dev_hrd_center",
      role: "HRD_CENTER",
      employeeId: null,
      companyId: null,
      email: null,
      employeeCode: null,
      displayName: null,
      companyCode: null,
      companyName: null,
      functionCode: null,
      functionName: null,
      positionCode: null,
      positionName: null,
      levelCode: null,
      levelName: null,
      pl: null,
      passwordHash: "must-not-reach-ui-state",
    },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("authentication UI client", () => {
  it("posts form credentials to the real login API with cookies enabled", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(sessionBody)) as unknown as typeof fetch;

    const user = await loginWithCredentials(
      "dev_hrd_center",
      "test-only-password",
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "dev_hrd_center",
        password: "test-only-password",
      }),
    });
    expect(user).toEqual({
      userId: "1",
      username: "dev_hrd_center",
      roleCode: "HRD_CENTER",
      employeeId: null,
      companyId: null,
      email: null,
      employeeCode: null,
      displayName: null,
      companyCode: null,
      companyName: null,
      functionCode: null,
      functionName: null,
      positionCode: null,
      positionName: null,
      levelCode: null,
      levelName: null,
      pl: null,
    });
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("restores a database-backed session with credentials included", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse(sessionBody)) as unknown as typeof fetch;

    await expect(getCurrentSession(fetcher)).resolves.toMatchObject({
      username: "dev_hrd_center",
      roleCode: "HRD_CENTER",
    });
    expect(fetcher).toHaveBeenCalledWith("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  });

  it("treats HTTP 401 session response as signed out", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: false }, 401)) as unknown as typeof fetch;

    await expect(getCurrentSession(fetcher)).resolves.toBeNull();
  });

  it("posts logout with credentials included", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true })) as unknown as typeof fetch;

    await expect(logoutCurrentSession(fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });
});
