import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCreateCourseGroupHandler, createListCourseGroupsHandler } from "../../app/api/master-data/course-groups/route";
import { createCreateCourseTypeHandler, createListCourseTypesHandler } from "../../app/api/master-data/course-types/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { CourseGroupRepository } from "../../app/lib/courseGroups/repository";
import { createCourseGroupService, type CourseGroupService } from "../../app/lib/courseGroups/service";
import { parseCreateCourseGroup } from "../../app/lib/courseGroups/validation";
import type { CourseTypeRepository } from "../../app/lib/courseTypes/repository";
import { createCourseTypeService, type CourseTypeService } from "../../app/lib/courseTypes/service";
import { parseCreateCourseType } from "../../app/lib/courseTypes/validation";

const principal = (role: "HRD_CENTER" | "HRD_FACTORY") => ({ userId: "1", username: "test", role }) as AuthenticatedPrincipal;
const auth = (user: AuthenticatedPrincipal) => ({ verifyToken: () => ({ version: 1 as const, userId: "1", issuedAt: 1, lastSeenAt: 2, bootId: "test-boot-id" }), revalidate: vi.fn().mockResolvedValue(user), rollToken: () => "rolled", production: false });
const request = (path: string, method = "GET", body?: unknown) => new NextRequest(`http://localhost${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { cookie: "tpm_session=valid", ...(body === undefined ? {} : { "content-type": "application/json" }) } });

describe("course classification validation", () => {
  it("normalizes approved Course Type and Course Group codes", () => {
    expect(parseCreateCourseType({ code: " in-house ", name: " In-house ", description: " Internal " })).toMatchObject({ code: "IN-HOUSE", name: "In-house", description: "Internal", status: "ACTIVE" });
    expect(parseCreateCourseGroup({ code: " qt ", name: " Quality " })).toEqual({ code: "QT", name: "Quality", status: "ACTIVE" });
  });
  it("rejects invalid codes", () => {
    expect(() => parseCreateCourseType({ code: "-BAD", name: "Bad" })).toThrow();
    expect(() => parseCreateCourseGroup({ code: "Q1", name: "Bad" })).toThrow();
  });
});

describe("course classification lifecycle rules", () => {
  it("locks a used Course Type code", async () => {
    const repo = { findById: vi.fn().mockResolvedValue({ courseTypeId: "1", code: "PUBLIC", name: "Public", description: null, status: "ACTIVE", hasBeenUsed: true }), findConflict: vi.fn(), activeCourseCount: vi.fn(), update: vi.fn() } as unknown as CourseTypeRepository;
    await expect(createCourseTypeService(repo).updateCourseType("1", { code: "OJT" }, "1")).rejects.toMatchObject({ code: "COURSE_TYPE_CODE_LOCKED", status: 409 });
  });
  it("locks a Course Group code after numbering starts", async () => {
    const repo = { findById: vi.fn().mockResolvedValue({ courseGroupId: "1", code: "QT", name: "Quality", status: "ACTIVE", lastCourseNumber: 1 }), findConflict: vi.fn(), activeCourseCount: vi.fn(), update: vi.fn() } as unknown as CourseGroupRepository;
    await expect(createCourseGroupService(repo).updateCourseGroup("1", { code: "ST" }, "1")).rejects.toMatchObject({ code: "COURSE_GROUP_CODE_LOCKED", status: 409 });
  });
});

describe("course classification route scope", () => {
  const typeService = () => ({ listCourseTypes: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }), createCourseType: vi.fn() }) as unknown as CourseTypeService;
  const groupService = () => ({ listCourseGroups: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }), createCourseGroup: vi.fn() }) as unknown as CourseGroupService;
  it("allows HRD_FACTORY to read both shared masters", async () => {
    expect((await createListCourseTypesHandler({ service: typeService(), auth: auth(principal("HRD_FACTORY")) })(request("/api/master-data/course-types"))).status).toBe(200);
    expect((await createListCourseGroupsHandler({ service: groupService(), auth: auth(principal("HRD_FACTORY")) })(request("/api/master-data/course-groups"))).status).toBe(200);
  });
  it("denies HRD_FACTORY create before calling services", async () => {
    const types = typeService(); const groups = groupService();
    expect((await createCreateCourseTypeHandler({ service: types, auth: auth(principal("HRD_FACTORY")) })(request("/api/master-data/course-types", "POST", { code: "OJT", name: "OJT" }))).status).toBe(403);
    expect((await createCreateCourseGroupHandler({ service: groups, auth: auth(principal("HRD_FACTORY")) })(request("/api/master-data/course-groups", "POST", { code: "QT", name: "Quality" }))).status).toBe(403);
    expect(types.createCourseType).not.toHaveBeenCalled(); expect(groups.createCourseGroup).not.toHaveBeenCalled();
  });
});
