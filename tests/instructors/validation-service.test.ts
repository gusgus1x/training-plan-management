import { describe, expect, it, vi } from "vitest";
import type { InstructorRepository } from "../../app/lib/instructors/repository";
import { createInstructorService } from "../../app/lib/instructors/service";
import { parseCreateInstructor } from "../../app/lib/instructors/validation";

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

const repository = () =>
  ({
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(record),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockImplementation(async (_id, input) => ({
      ...record,
      ...input,
    })),
    isReferenced: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(record),
  }) as unknown as InstructorRepository;

describe("instructor validation and service", () => {
  it("normalizes the approved mock Instructor", () => {
    expect(
      parseCreateInstructor({
        instructorCode: " ins0001 ",
        firstName: " Somchai ",
        lastName: " Prasert ",
        telephone: " 081-234-5678 ",
        education: " M.B.A. Human Resource Management ",
      }),
    ).toEqual({
      instructorCode: "INS0001",
      firstName: "Somchai",
      lastName: "Prasert",
      telephone: "081-234-5678",
      email: null,
      education: "M.B.A. Human Resource Management",
      university: null,
      organizationName: null,
      status: "ACTIVE",
    });
  });

  it("rejects an invalid email address", () => {
    expect(() =>
      parseCreateInstructor({
        instructorCode: "INS0001",
        firstName: "Somchai",
        lastName: "Prasert",
        email: "not-an-email",
      }),
    ).toThrowError(/invalid/i);
  });

  it("deactivates a referenced Instructor instead of deleting it", async () => {
    const mock = repository();
    vi.mocked(mock.isReferenced).mockResolvedValue(true);

    await expect(
      createInstructorService(mock).deleteInstructor("1"),
    ).resolves.toMatchObject({
      outcome: "DEACTIVATED",
      instructor: { status: "INACTIVE" },
    });
    expect(mock.update).toHaveBeenCalledWith("1", { status: "INACTIVE" });
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes an unreferenced Instructor", async () => {
    const mock = repository();

    await expect(
      createInstructorService(mock).deleteInstructor("1"),
    ).resolves.toMatchObject({ outcome: "DELETED" });
    expect(mock.delete).toHaveBeenCalledWith("1");
  });
});
