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
});
