import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreateCompanyHandler,
  createListCompaniesHandler,
} from "../../app/api/master-data/companies/route";
import {
  createDeleteCompanyHandler,
  createGetCompanyHandler,
  createUpdateCompanyHandler,
} from "../../app/api/master-data/companies/[companyId]/route";
import type { CompanyService } from "../../app/lib/companies/service";
import type { CompanyRecord } from "../../app/lib/companies/types";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const company: CompanyRecord = {
  companyId: "1",
  companyCode: "ATA",
  companyNameTh: "บริษัท ไอซิน ทาคาโอกะ เอเชีย จำกัด",
  companyNameEn: "Aisin Takaoka Asia Co., Ltd.",
  remark: null,
  status: "ACTIVE",
};

const center: AuthenticatedPrincipal = {
  userId: "1",
  username: "center.test",
  role: "HRD_CENTER",
  employeeId: null,
  employeeUserId: null,
  companyId: null,
  email: null,
  employeeCode: null,
  displayName: "Center Test",
  companyCode: null,
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
};

const factory: AuthenticatedPrincipal = {
  ...center,
  userId: "2",
  username: "factory.test",
  role: "HRD_FACTORY",
  companyId: "1",
  companyCode: "ATA",
};

const createService = () =>
  ({
    listCompanies: vi
      .fn()
      .mockResolvedValue({ items: [company], totalItems: 1 }),
    getCompany: vi.fn().mockResolvedValue(company),
    createCompany: vi.fn().mockResolvedValue(company),
    updateCompany: vi.fn().mockResolvedValue(company),
    deleteCompany: vi.fn().mockResolvedValue(company),
  }) as unknown as CompanyService;

const auth = (principal: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: principal.userId,
    issuedAt: 100,
    lastSeenAt: 200,
    bootId: "test-boot-id",
  }),
  revalidate: vi.fn().mockResolvedValue(principal),
  rollToken: () => "rolled-token",
  production: false,
});

const request = (url: string, init?: RequestInit) =>
  new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: {
      cookie: "tpm_session=valid-token",
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });

describe("company API routes", () => {
  it("allows HRD_CENTER to list paginated companies", async () => {
    const service = createService();
    const handler = createListCompaniesHandler({
      service,
      auth: auth(center),
    });
    const response = await handler(
      request(
        "http://localhost/api/master-data/companies?page=2&pageSize=10&status=ACTIVE",
      ),
    );

    expect(response.status).toBe(200);
    expect(service.listCompanies).toHaveBeenCalledWith({
      search: null,
      status: "ACTIVE",
      skip: 10,
      take: 10,
    });
  });

  it("allows HRD_FACTORY to list every company for reference use", async () => {
    const service = createService();
    const handler = createListCompaniesHandler({
      service,
      auth: auth(factory),
    });
    const response = await handler(
      request("http://localhost/api/master-data/companies"),
    );

    expect(response.status).toBe(200);
    expect(service.listCompanies).toHaveBeenCalledWith({
      search: null,
      status: null,
      skip: 0,
      take: 20,
    });
  });

  it("validates and creates a company without accepting client scope", async () => {
    const service = createService();
    const handler = createCreateCompanyHandler({
      service,
      auth: auth(center),
    });
    const response = await handler(
      request("http://localhost/api/master-data/companies", {
        method: "POST",
        body: JSON.stringify({
          companyCode: "new",
          companyNameTh: "บริษัทใหม่",
          companyNameEn: "",
          status: "active",
          roleId: 999,
          companyId: "999",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(service.createCompany).toHaveBeenCalledWith({
      companyCode: "NEW",
      companyNameTh: "บริษัทใหม่",
      companyNameEn: null,
      remark: null,
      status: "ACTIVE",
    });
  });

  it("does not allow HRD_FACTORY to create a new root company", async () => {
    const service = createService();
    const handler = createCreateCompanyHandler({
      service,
      auth: auth(factory),
    });
    const response = await handler(
      request("http://localhost/api/master-data/companies", {
        method: "POST",
        body: JSON.stringify({
          companyCode: "NEW",
          companyNameTh: "New",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(service.createCompany).not.toHaveBeenCalled();
  });

  it("passes a validated dynamic id to detail and update services", async () => {
    const service = createService();
    const context = { params: Promise.resolve({ companyId: "1" }) };
    const getHandler = createGetCompanyHandler({
      service,
      auth: auth(center),
    });
    const patchHandler = createUpdateCompanyHandler({
      service,
      auth: auth(center),
    });

    expect(
      (
        await getHandler(
          request("http://localhost/api/master-data/companies/1"),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await patchHandler(
          request("http://localhost/api/master-data/companies/1", {
            method: "PATCH",
            body: JSON.stringify({ status: "INACTIVE" }),
          }),
          context,
        )
      ).status,
    ).toBe(200);

    expect(service.getCompany).toHaveBeenCalledWith("1");
    expect(service.updateCompany).toHaveBeenCalledWith("1", {
      status: "INACTIVE",
    });
  });

  it("rejects an invalid dynamic id before querying the service", async () => {
    const service = createService();
    const handler = createGetCompanyHandler({
      service,
      auth: auth(center),
    });
    const response = await handler(
      request("http://localhost/api/master-data/companies/not-an-id"),
      { params: Promise.resolve({ companyId: "not-an-id" }) },
    );

    expect(response.status).toBe(400);
    expect(service.getCompany).not.toHaveBeenCalled();
  });

  it("allows HRD_FACTORY to read all companies but keeps every company read-only", async () => {
    const service = createService();
    const ownContext = { params: Promise.resolve({ companyId: "1" }) };
    const otherContext = { params: Promise.resolve({ companyId: "2" }) };
    const patchHandler = createUpdateCompanyHandler({
      service,
      auth: auth(factory),
    });
    const getHandler = createGetCompanyHandler({
      service,
      auth: auth(factory),
    });
    const deleteHandler = createDeleteCompanyHandler({
      service,
      auth: auth(factory),
    });

    expect(
      (
        await getHandler(
          request("http://localhost/api/master-data/companies/1"),
          ownContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await getHandler(
          request("http://localhost/api/master-data/companies/2"),
          otherContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await patchHandler(
          request("http://localhost/api/master-data/companies/1", {
            method: "PATCH",
            body: JSON.stringify({ remark: "Own company" }),
          }),
          ownContext,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await patchHandler(
          request("http://localhost/api/master-data/companies/2", {
            method: "PATCH",
            body: JSON.stringify({ remark: "Other company" }),
          }),
          otherContext,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await deleteHandler(
          request("http://localhost/api/master-data/companies/2", {
            method: "DELETE",
          }),
          otherContext,
        )
      ).status,
    ).toBe(403);

    expect(service.getCompany).toHaveBeenCalledTimes(2);
    expect(service.getCompany).toHaveBeenNthCalledWith(1, "1");
    expect(service.getCompany).toHaveBeenNthCalledWith(2, "2");
    expect(service.updateCompany).not.toHaveBeenCalled();
    expect(service.deleteCompany).not.toHaveBeenCalled();
  });

  it("allows HRD_CENTER to delete an unreferenced company", async () => {
    const service = createService();
    const handler = createDeleteCompanyHandler({
      service,
      auth: auth(center),
    });
    const response = await handler(
      request("http://localhost/api/master-data/companies/7", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ companyId: "7" }) },
    );

    expect(response.status).toBe(200);
    expect(service.deleteCompany).toHaveBeenCalledWith("7");
  });
});
