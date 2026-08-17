import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreateInstituteProviderHandler,
  createListInstituteProvidersHandler,
} from "../../app/api/master-data/institute-providers/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { InstituteProviderService } from "../../app/lib/instituteProviders/service";

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
    listInstituteProviders: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    createInstituteProvider: vi.fn().mockResolvedValue({
      instituteProviderId: "1",
      instituteProviderCode: "ATA",
      instituteProviderName: "ATA",
      status: "ACTIVE",
    }),
  }) as unknown as InstituteProviderService;
const request = (method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/master-data/institute-providers", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      cookie: "tpm_session=valid",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
  });

describe("institute provider routes", () => {
  it("allows factory read access", async () => {
    const mock = service();
    const response = await createListInstituteProvidersHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(request());
    expect(response.status).toBe(200);
    expect(mock.listInstituteProviders).toHaveBeenCalled();
  });

  it("keeps writes center-only", async () => {
    const mock = service();
    const response = await createCreateInstituteProviderHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(
      request("POST", {
        instituteProviderCode: "ATA",
        instituteProviderName: "ATA",
      }),
    );
    expect(response.status).toBe(403);
    expect(mock.createInstituteProvider).not.toHaveBeenCalled();
  });
});
