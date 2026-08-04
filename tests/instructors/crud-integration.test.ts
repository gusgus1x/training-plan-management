import { config as loadEnvironment } from "dotenv";
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { createUpdateInstructorHandler } from "../../app/api/master-data/instructors/[instructorId]/route";
import { createSessionToken } from "../../app/lib/auth/session";

const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

databaseMutationTest(
  "performs Instructor CRUD through the application login",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-9);
    const instructorCode = `ZZINS${suffix}`;

    try {
      const created = await prisma.instructor.create({
        data: {
          instructor_code: instructorCode,
          first_name: "Instructor CRUD",
          last_name: "Test",
          status: "ACTIVE",
        },
      });
      const updated = await prisma.instructor.update({
        where: { instructor_id: created.instructor_id },
        data: { organization_name: "Updated organization", status: "INACTIVE" },
      });
      await prisma.instructor.delete({
        where: { instructor_id: created.instructor_id },
      });

      expect(updated.organization_name).toBe("Updated organization");
      expect(updated.status).toBe("INACTIVE");
      await expect(
        prisma.instructor.count({ where: { instructor_code: instructorCode } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.instructor
        .deleteMany({ where: { instructor_code: instructorCode } })
        .catch(() => undefined);
      await resetPrismaClient();
    }
  },
  15_000,
);

databaseMutationTest(
  "updates Instructor with the full Edit-form payload through a real HRD_CENTER session",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const instructor = await prisma.instructor.findUnique({
      where: { instructor_code: "INS0001" },
    });
    const centerAccount = await prisma.user_account.findFirst({
      where: {
        status: "ACTIVE",
        role: { role_code: "HRD_CENTER", status: "ACTIVE" },
      },
      select: { user_id: true },
    });

    expect(instructor).not.toBeNull();
    expect(centerAccount).not.toBeNull();
    if (!instructor || !centerAccount) return;

    const originalOrganization = instructor.organization_name;
    const testOrganization = `PATCH test ${Date.now()}`;

    try {
      const token = createSessionToken(centerAccount.user_id.toString());
      const response = await createUpdateInstructorHandler()(
        new NextRequest("http://localhost/api/master-data/instructors/1", {
          method: "PATCH",
          headers: {
            cookie: `tpm_session=${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            instructorCode: instructor.instructor_code,
            firstName: instructor.first_name,
            lastName: instructor.last_name,
            telephone: instructor.telephone,
            email: instructor.email,
            education: instructor.education,
            organizationName: testOrganization,
            status: instructor.status,
          }),
        }),
        {
          params: Promise.resolve({
            instructorId: instructor.instructor_id.toString(),
          }),
        },
      );
      const body = (await response.json()) as {
        data?: { instructor?: { organizationName?: string | null } };
      };

      expect(response.status).toBe(200);
      expect(body.data?.instructor?.organizationName).toBe(testOrganization);
    } finally {
      await prisma.instructor.update({
        where: { instructor_id: instructor.instructor_id },
        data: { organization_name: originalOrganization },
      });
      await resetPrismaClient();
    }
  },
  15_000,
);
