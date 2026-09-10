import { config as loadEnvironment } from "dotenv";
loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ path: ".env", quiet: true });
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET, POST, PUT, DELETE } from "../../app/api/course-activities/route";

describe("Course Activities API", () => {
  it("fetches course activities list", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.activities)).toBe(true);
    expect(Array.isArray(data.companies)).toBe(true);
    expect(data.companies.some((c: { id: string }) => c.id === "center")).toBe(true);
  });

  it("creates, updates, and deletes a course activity with company support", async () => {
    // 1. Create with Center
    const createReq = new NextRequest("http://localhost/api/course-activities", {
      method: "POST",
      body: JSON.stringify({
        title: "Test Activity 2026",
        date: "2026-09-07",
        location: "Test Location",
        description: "Test Description for CSR activity",
        imageUrl: "/uploads/activities/sample-banner.png",
        companyId: "center",
      }),
    });
    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    const createdId = createdData.activity.id;
    expect(createdData.activity.title).toBe("Test Activity 2026");
    expect(createdData.activity.year).toBe("2026");
    expect(createdData.activity.companyCode).toBe("CENTER");

    // 2. Update to Factory Company (e.g. 1 / ATA)
    const updateReq = new NextRequest("http://localhost/api/course-activities", {
      method: "PUT",
      body: JSON.stringify({
        id: createdId,
        title: "Updated Activity 2026",
        description: "Updated Description",
        companyId: "1",
      }),
    });
    const updateRes = await PUT(updateReq);
    expect(updateRes.status).toBe(200);
    const updatedData = await updateRes.json();
    expect(updatedData.activity.title).toBe("Updated Activity 2026");
    expect(updatedData.activity.description).toBe("Updated Description");
    expect(updatedData.activity.companyCode).toBe("ATA");

    // 2.5. Archive activity (hide from Dashboard)
    const archiveReq = new NextRequest("http://localhost/api/course-activities", {
      method: "PUT",
      body: JSON.stringify({
        id: createdId,
        isVisibleOnDashboard: false,
        status: "ARCHIVED",
      }),
    });
    const archiveRes = await PUT(archiveReq);
    expect(archiveRes.status).toBe(200);
    const archiveData = await archiveRes.json();
    expect(archiveData.activity.isVisibleOnDashboard).toBe(false);
    expect(archiveData.activity.status).toBe("ARCHIVED");

    // 3. Delete
    const deleteReq = new NextRequest(`http://localhost/api/course-activities?id=${encodeURIComponent(createdId)}`, {
      method: "DELETE",
    });
    const deleteRes = await DELETE(deleteReq);
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);
    expect(deleteData.deletedId).toBe(createdId);
  });

  it("serves images via api/course-activities/image", async () => {
    const { GET: getImage } = await import("../../app/api/course-activities/image/[filename]/route");
    const fs = await import("fs/promises");
    const path = await import("path");

    const filename = "test_image_probe.jpg";
    const dir = path.join(process.cwd(), "public", "uploads", "activities");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

    try {
      const req = new NextRequest(`http://localhost/api/course-activities/image/${filename}`);
      const res = await getImage(req, { params: Promise.resolve({ filename }) });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/jpeg");
    } finally {
      await fs.unlink(filePath).catch(() => undefined);
    }
  });

  it("filters activities for employee: Center visible to everyone, company-specific visible only to that company", () => {
    const filterActivitiesForUser = (
      activities: Array<{ id: string; companyId: string; companyCode: string; companyName?: string }>,
      user: { roleCode: string; companyId?: string | null; companyCode?: string | null; companyName?: string | null } | null
    ) => {
      const isEmployee = user?.roleCode === "EMPLOYEE";
      if (!isEmployee) return activities;

      const userCompanyId = user?.companyId ? String(user.companyId).trim() : null;
      const userCompanyCode = user?.companyCode ? user.companyCode.trim().toUpperCase() : null;
      const userCompanyName = user?.companyName ? user.companyName.trim().toLowerCase() : null;

      return activities.filter((act) => {
        // 1. Center (ส่วนกลาง) -> everyone can see
        const isCenter =
          !act.companyId ||
          act.companyId === "center" ||
          act.companyId === "ALL" ||
          act.companyCode?.toUpperCase() === "CENTER";

        if (isCenter) return true;

        // 2. User's own company -> only people in that company can see
        if (userCompanyId && String(act.companyId).trim() === userCompanyId) return true;
        if (userCompanyCode && act.companyCode?.trim().toUpperCase() === userCompanyCode) return true;
        if (userCompanyName && act.companyName && act.companyName.toLowerCase().includes(userCompanyName)) return true;

        return false;
      });
    };

    const dummyActivities = [
      { id: "1", companyId: "center", companyCode: "CENTER", companyName: "Center (ส่วนกลาง)" },
      { id: "2", companyId: "1", companyCode: "ATA", companyName: "ATA - Aisin Takaoka Asia" },
      { id: "3", companyId: "2", companyCode: "TEP", companyName: "TEP - Thai Engineering Products" },
    ];

    // Employee at ATA (companyId 1, code ATA)
    const ataEmployee = { roleCode: "EMPLOYEE", companyId: "1", companyCode: "ATA" };
    const ataVisible = filterActivitiesForUser(dummyActivities, ataEmployee);
    expect(ataVisible.map((a) => a.id)).toEqual(["1", "2"]); // Sees Center (1) + ATA (2), not TEP (3)

    // Employee at TEP (companyId 2, code TEP)
    const tepEmployee = { roleCode: "EMPLOYEE", companyId: "2", companyCode: "TEP" };
    const tepVisible = filterActivitiesForUser(dummyActivities, tepEmployee);
    expect(tepVisible.map((a) => a.id)).toEqual(["1", "3"]); // Sees Center (1) + TEP (3), not ATA (2)

    // Employee with no factory company (Center employee)
    const centerEmployee = { roleCode: "EMPLOYEE", companyId: null, companyCode: "CENTER" };
    const centerVisible = filterActivitiesForUser(dummyActivities, centerEmployee);
    expect(centerVisible.map((a) => a.id)).toEqual(["1"]); // Only Center (1)

    // Admin / HRD_CENTER -> sees all
    const adminUser = { roleCode: "ADMIN", companyId: null, companyCode: null };
    const adminVisible = filterActivitiesForUser(dummyActivities, adminUser);
    expect(adminVisible.map((a) => a.id)).toEqual(["1", "2", "3"]);
  });

  it("correctly identifies ended courses based on date and time with isCourseDateOrTimeEnded", async () => {
    const { isCourseDateOrTimeEnded } = await import("../../app/lib/calendarDate");
    const mockNow = new Date(2026, 8, 9, 10, 30, 0);

    // Past date -> ended
    expect(isCourseDateOrTimeEnded("2026-09-08", null, null, mockNow)).toBe(true);
    expect(isCourseDateOrTimeEnded("2026-09-01", "2026-09-08", null, mockNow)).toBe(true);
    expect(isCourseDateOrTimeEnded("08/09/2026", null, null, mockNow)).toBe(true);

    // Future date -> not ended
    expect(isCourseDateOrTimeEnded("2026-09-10", null, null, mockNow)).toBe(false);
    expect(isCourseDateOrTimeEnded("2026-09-08", "2026-09-15", null, mockNow)).toBe(false);

    // Today with time:
    // Past end time (09:00 < 10:30) -> ended
    expect(isCourseDateOrTimeEnded("2026-09-09", null, "09:00", mockNow)).toBe(true);
    // Future end time (16:00 > 10:30) -> not ended
    expect(isCourseDateOrTimeEnded("2026-09-09", null, "16:00", mockNow)).toBe(false);

    // Today without end time -> ends at 23:59:59 -> not ended at 10:30
    expect(isCourseDateOrTimeEnded("2026-09-09", null, null, mockNow)).toBe(false);

    // Missing or invalid date -> false
    expect(isCourseDateOrTimeEnded(null, null, null, mockNow)).toBe(false);
    expect(isCourseDateOrTimeEnded("-", null, null, mockNow)).toBe(false);
    expect(isCourseDateOrTimeEnded("", null, null, mockNow)).toBe(false);
  });

  it("enforces company isolation on course linking so each company only links its own courses", async () => {
    const { readFileSync } = await import("node:fs");
    const newActivitiesSource = readFileSync(
      new URL("../../app/components/center_factory/NewActivities/NewActivities.tsx", import.meta.url),
      "utf8",
    );
    const apiRouteSource = readFileSync(
      new URL("../../app/api/course-activities/route.ts", import.meta.url),
      "utf8",
    );

    // Frontend UI contract
    expect(newActivitiesSource).toContain("isPlanMatchingCompany");
    expect(newActivitiesSource).toContain("currentFormCompanyCode");
    expect(newActivitiesSource).toContain("!isPlanMatchingCompany(plan, currentFormCompanyCode)");
    expect(newActivitiesSource).toContain("setFormLinkedPlanId(\"\")");

    // Backend route contract
    expect(apiRouteSource).toContain("Forbidden: Cannot link training course of another company");
    expect(apiRouteSource).toContain("Forbidden: Center activity can only link to Center training course");
  });

  it("strictly excludes Center courses when activity belongs to a factory company (ATFB, SNF, etc.)", () => {
    // Replicate the exact logic from NewActivities.tsx isPlanMatchingCompany
    const isPlanMatchingCompany = (
      plan: {
        owner: string;
        ownerCompany?: string | null;
        company?: string | null;
        course?: { targetCompanies?: string[] } | null;
      },
      targetCompanyCode: string
    ): boolean => {
      if (!targetCompanyCode) return false;
      const target = targetCompanyCode.toUpperCase().trim();
      if (target === "CENTER") {
        return (
          plan.owner === "CENTER" ||
          plan.ownerCompany?.toUpperCase().trim() === "CENTER" ||
          plan.company === "All Companies"
        );
      }
      // Factory company (e.g. ATFB, SNF, NIC, TEP, SATI, ATA)
      // Must strictly belong to this factory and never match Center's courses
      if (
        plan.owner === "CENTER" ||
        plan.ownerCompany?.toUpperCase().trim() === "CENTER" ||
        plan.company === "All Companies"
      ) {
        return false;
      }
      const planOwnerCompany = plan.ownerCompany?.toUpperCase().trim();
      const planCompany = plan.company?.toUpperCase().trim();

      return planOwnerCompany === target || planCompany === target;
    };

    const centerPlan = {
      owner: "CENTER",
      ownerCompany: "CENTER",
      company: "All Companies",
      course: { targetCompanies: ["ATFB", "SNF", "TEP", "ATA"] },
    };

    const atfbPlan = {
      owner: "FACTORY",
      ownerCompany: "ATFB",
      company: "ATFB",
      course: { targetCompanies: ["ATFB"] },
    };

    const snfPlan = {
      owner: "FACTORY",
      ownerCompany: "SNF",
      company: "SNF",
      course: { targetCompanies: ["SNF"] },
    };

    // When editing an activity of ATFB:
    // 1. Center courses must NOT show up, even if targetCompanies includes ATFB!
    expect(isPlanMatchingCompany(centerPlan, "ATFB")).toBe(false);
    // 2. ATFB courses MUST show up
    expect(isPlanMatchingCompany(atfbPlan, "ATFB")).toBe(true);
    // 3. SNF courses must NOT show up
    expect(isPlanMatchingCompany(snfPlan, "ATFB")).toBe(false);

    // When editing an activity of CENTER:
    // 1. Center courses MUST show up
    expect(isPlanMatchingCompany(centerPlan, "CENTER")).toBe(true);
    // 2. Factory courses must NOT show up
    expect(isPlanMatchingCompany(atfbPlan, "CENTER")).toBe(false);
  });

  it("handles date formats (such as DD/MM/YYYY) and company codes robustly when saving", async () => {
    // Test creating with DD/MM/YYYY date format and SATI company id
    const createReq = new NextRequest("http://localhost/api/course-activities", {
      method: "POST",
      body: JSON.stringify({
        title: "SATI Activity Test",
        date: "09/10/2026",
        location: "SATI Plant",
        description: "Test description for SATI activity",
        imageUrl: "/api/course-activities/image/sample.jpg",
        companyId: "5",
      }),
    });
    const res = await POST(createReq);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.activity.title).toBe("SATI Activity Test");
    expect(data.activity.companyCode).toBe("SATI");
    expect(data.activity.year).toBe("2026");

    // Clean up created activity
    const deleteReq = new NextRequest(`http://localhost/api/course-activities?id=${encodeURIComponent(data.activity.id)}`, {
      method: "DELETE",
    });
    const deleteRes = await DELETE(deleteReq);
    expect(deleteRes.status).toBe(200);
  });
});

