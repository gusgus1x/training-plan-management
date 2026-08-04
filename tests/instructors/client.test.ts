import { describe, expect, it, vi } from "vitest";
import {
  createInstructor,
  updateInstructor,
} from "../../app/lib/instructors/client";

const response = () =>
  new Response(
    JSON.stringify({
      ok: true,
      data: {
        instructor: {
          instructorId: "1",
          instructorCode: "INS0001",
          firstName: "Updated",
          lastName: "Instructor",
          telephone: null,
          email: null,
          education: null,
          organizationName: null,
          status: "ACTIVE",
        },
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const input = {
  instructorCode: "INS0001",
  firstName: "Updated",
  lastName: "Instructor",
  telephone: null,
  email: null,
  education: null,
  organizationName: null,
  status: "ACTIVE" as const,
};

describe("Instructor client write operation", () => {
  it("uses POST only when creating a new Instructor", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());

    await createInstructor(input, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/master-data/instructors",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses the Instructor ID and PATCH when saving edits", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());

    await updateInstructor("1", input, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/master-data/instructors/1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
