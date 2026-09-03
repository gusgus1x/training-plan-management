import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreateInstructorHandler,
  createListInstructorsHandler,
} from "../../app/api/master-data/instructors/route";
import { createDeleteInstructorHandler } from "../../app/api/master-data/instructors/[instructorId]/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { InstructorService } from "../../app/lib/instructors/service";

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
const record = {
  instructorId: "1",
  instructorCode: "INS0001",
  firstName: "Somchai",
  lastName: "Prasert",
  telephone: "081-234-5678",
  email: null,
  education: "M.B.A. Human Resource Management",
  university: null,
  organizationName: null,
  status: "ACTIVE" as const,
};
const service = () =>
  ({
    listInstructors: vi.fn().mockResolvedValue({ items: [record], totalItems: 1 }),
    createInstructor: vi.fn().mockResolvedValue(record),
    deleteInstructor: vi.fn().mockResolvedValue({
      instructor: record,
      outcome: "DELETED",
    }),
  }) as unknown as InstructorService;
const request = (method = "GET", body?: unknown) =>
  new NextRequest("http://localhost/api/master-data/instructors", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      cookie: "tpm_session=valid",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
  });

describe("instructor routes", () => {
  it("allows HRD_FACTORY to read the shared Instructor master", async () => {
    const mock = service();
    const response = await createListInstructorsHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(request());

    expect(response.status).toBe(200);
    expect(mock.listInstructors).toHaveBeenCalled();
  });

  it("keeps create center-only", async () => {
    const mock = service();
    const response = await createCreateInstructorHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(
      request("POST", {
        instructorCode: "INS0001",
        firstName: "Somchai",
        lastName: "Prasert",
      }),
    );

    expect(response.status).toBe(403);
    expect(mock.createInstructor).not.toHaveBeenCalled();
  });

  it("keeps delete center-only", async () => {
    const mock = service();
    const response = await createDeleteInstructorHandler({
      service: mock,
      auth: auth(user("HRD_FACTORY")),
    })(request("DELETE"), { params: Promise.resolve({ instructorId: "1" }) });

    expect(response.status).toBe(403);
    expect(mock.deleteInstructor).not.toHaveBeenCalled();
  });
});
