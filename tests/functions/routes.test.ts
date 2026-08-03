import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCreateFunctionHandler } from "../../app/api/master-data/functions/route";
import {
  createCreateMappingHandler,
  createListMappingsHandler,
} from "../../app/api/master-data/function-mappings/route";
import {
  createGetMappingHandler,
  createUpdateMappingHandler,
} from "../../app/api/master-data/function-mappings/[mappingId]/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { FunctionService } from "../../app/lib/functions/service";

const principal = (
  role: "HRD_CENTER" | "HRD_FACTORY",
  companyId: string | null,
) =>
  ({
    userId: "1",
    username: "test",
    role,
    companyId,
  }) as AuthenticatedPrincipal;

const factory = principal("HRD_FACTORY", "1");
const center = principal("HRD_CENTER", null);
const mapping = {
  functionMappingId: "10",
  companyId: "2",
  companyCode: "TEP",
  companyNameTh: "TEP",
  plantFunctionCode: "TEP-HR",
  plantFunctionName: "HR",
  functionId: "4",
  functionCode: "FNC0004",
  functionNameTh: "ทรัพยากรมนุษย์",
  status: "ACTIVE",
} as const;

const service = () =>
  ({
    listMappings: vi.fn().mockResolvedValue({
      items: [mapping],
      totalItems: 1,
    }),
    createMapping: vi.fn().mockResolvedValue(mapping),
    getMapping: vi.fn().mockResolvedValue(mapping),
    updateMapping: vi.fn().mockResolvedValue(mapping),
    createFunction: vi.fn(),
  }) as unknown as FunctionService;

const auth = (user: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: user.userId,
    issuedAt: 1,
    lastSeenAt: 2,
  }),
  revalidate: vi.fn().mockResolvedValue(user),
  rollToken: () => "rolled",
  production: false,
});

const request = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      cookie: "tpm_session=valid",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
  });

describe("function routes", () => {
  it("scopes the factory mapping list to session company_id", async () => {
    const mock = service();
    const response = await createListMappingsHandler({
      service: mock,
      auth: auth(factory),
    })(request("http://localhost/api/master-data/function-mappings"));
    expect(response.status).toBe(200);
    expect(mock.listMappings).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "1" }),
    );
  });

  it("overrides a factory mapping company with session company_id", async () => {
    const mock = service();
    const response = await createCreateMappingHandler({
      service: mock,
      auth: auth(factory),
    })(
      request("http://localhost/api/master-data/function-mappings", "POST", {
        companyId: "999",
        plantFunctionCode: "ATA-HR",
        plantFunctionName: "HR",
        functionId: "4",
      }),
    );
    expect(response.status).toBe(201);
    expect(mock.createMapping).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "1" }),
    );
  });

  it("blocks factory updates to another company's mapping", async () => {
    const mock = service();
    const response = await createUpdateMappingHandler({
      service: mock,
      auth: auth(factory),
    })(
      request(
        "http://localhost/api/master-data/function-mappings/10",
        "PATCH",
        { plantFunctionName: "Changed" },
      ),
      { params: Promise.resolve({ mappingId: "10" }) },
    );
    expect(response.status).toBe(403);
    expect(mock.updateMapping).not.toHaveBeenCalled();
  });

  it("blocks factory detail access to another company's mapping", async () => {
    const mock = service();
    const response = await createGetMappingHandler({
      service: mock,
      auth: auth(factory),
    })(
      request("http://localhost/api/master-data/function-mappings/10"),
      { params: Promise.resolve({ mappingId: "10" }) },
    );
    expect(response.status).toBe(403);
  });

  it("keeps central function creation center-only", async () => {
    const mock = service();
    const handler = createCreateFunctionHandler({
      service: mock,
      auth: auth(factory),
    });
    expect(
      (
        await handler(
          request("http://localhost/api/master-data/functions", "POST", {
            functionCode: "FNC0099",
            functionNameTh: "Test",
          }),
        )
      ).status,
    ).toBe(403);
    expect(mock.createFunction).not.toHaveBeenCalled();

    const centerMock = service();
    vi.mocked(centerMock.createFunction).mockResolvedValue({
      functionId: "99",
      functionCode: "FNC0099",
      functionNameTh: "Test",
      functionNameEn: null,
      status: "ACTIVE",
    });
    expect(
      (
        await createCreateFunctionHandler({
          service: centerMock,
          auth: auth(center),
        })(
          request("http://localhost/api/master-data/functions", "POST", {
            functionCode: "FNC0099",
            functionNameTh: "Test",
          }),
        )
      ).status,
    ).toBe(201);
  });
});
