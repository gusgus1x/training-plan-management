import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreatePositionHandler,
  createListPositionsHandler,
} from "../../app/api/master-data/positions/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { PositionService } from "../../app/lib/positions/service";

const user = (role: "HRD_CENTER" | "HRD_FACTORY") =>
  ({ userId: "1", username: "test", role }) as AuthenticatedPrincipal;
const auth = (principal: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: "1",
    issuedAt: 1,
    lastSeenAt: 2,
  }),
  revalidate: vi.fn().mockResolvedValue(principal),
  rollToken: () => "rolled",
  production: false,
});
const service = () =>
  ({
    listPositions: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    createPosition: vi.fn().mockResolvedValue({
      positionId: "1",
      positionCode: "OFFICE",
      positionNameTh: "เจ้าหน้าที่",
      positionNameEn: "Supervisor",
      status: "ACTIVE",
    }),
  }) as unknown as PositionService;
const request = (method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/master-data/positions", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      cookie: "tpm_session=valid",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
  });

describe("position routes", () => {
  it("allows factory read access", async () => {
    const mock = service();
    const response = await createListPositionsHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(request());
    expect(response.status).toBe(200);
    expect(mock.listPositions).toHaveBeenCalled();
  });

  it("keeps writes center-only", async () => {
    const mock = service();
    const response = await createCreatePositionHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(
      request("POST", {
        positionCode: "OFFICE",
        positionNameTh: "เจ้าหน้าที่",
      }),
    );
    expect(response.status).toBe(403);
    expect(mock.createPosition).not.toHaveBeenCalled();
  });
});
