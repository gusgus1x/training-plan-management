import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreateLevelHandler,
  createListLevelsHandler,
} from "../../app/api/master-data/levels/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { LevelService } from "../../app/lib/levels/service";

const user = (role: "HRD_CENTER" | "HRD_FACTORY") =>
  ({ userId: "1", username: "test", role }) as AuthenticatedPrincipal;
const auth = (principal: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: "1",
    issuedAt: 1,
    lastSeenAt: 2,
    bootId: "test-boot-id",
  }),
  revalidate: vi.fn().mockResolvedValue(principal),
  rollToken: () => "rolled",
  production: false,
});
const service = () =>
  ({
    listLevels: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    createLevel: vi.fn(),
  }) as unknown as LevelService;
const request = (method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/master-data/levels", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      cookie: "tpm_session=valid",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
  });

describe("level routes", () => {
  it("allows HRD_FACTORY read access", async () => {
    const mock = service();
    const response = await createListLevelsHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(request());
    expect(response.status).toBe(200);
    expect(mock.listLevels).toHaveBeenCalled();
  });

  it("keeps writes HRD_CENTER-only", async () => {
    const mock = service();
    const response = await createCreateLevelHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(
      request("POST", {
        levelCodeTh: "บ",
        levelCodeEn: "S",
        levelNameTh: "บังคับบัญชา1",
        pl: "1",
        levelKey: "บ1",
      }),
    );
    expect(response.status).toBe(403);
    expect(mock.createLevel).not.toHaveBeenCalled();
  });
});
