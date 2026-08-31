import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createProtectedRoute } from "../../../lib/auth/guard";
import {
  getCourseOutlineFileName,
  type CourseOutlineRequest,
} from "../../../lib/courseOutlineExport";
import { buildCourseOutlineWorkbook } from "../../../lib/courseOutlineWorkbook";

export const runtime = "nodejs";

const findTemplatePath = async () => {
  const directory = path.join(process.cwd(), "app", "Excel");
  const templateName = (await readdir(directory)).find(
    (name) =>
      name.startsWith("ATA-F-HD-005-") &&
      name.toLocaleLowerCase().includes("outline") &&
      name.toLocaleLowerCase().endsWith(".xlsx"),
  );
  if (!templateName) throw new Error("ไม่พบไฟล์ต้นแบบ Course Outline");
  return path.join(directory, templateName);
};

// HTTP headers are ASCII-only, so a Thai course name travels in the RFC 5987
// filename* field while filename= keeps a plain fallback for old clients.
const buildContentDisposition = (fileName: string) => {
  const asciiName =
    fileName.replace(/[^\x20-\x7E]+/g, "-").replace(/"/g, "") || "course-outline.xlsx";
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

// Reads a template off disk and builds a workbook per request, so it stays behind the same guard
// as every other route: an unauthenticated caller could otherwise spin these up at will.
export const POST = createProtectedRoute(async (request) => {
  try {
    const { course, standard, oapPlan, schedule, budget } =
      (await request.json()) as CourseOutlineRequest;
    if (!course || !course.courseCode || (!course.courseNameTh && !course.courseNameEn)) {
      return NextResponse.json(
        { error: "ข้อมูล Course Master ไม่ครบถ้วน" },
        { status: 400 },
      );
    }
    const template = await readFile(await findTemplatePath());
    const workbook = buildCourseOutlineWorkbook(
      template,
      course,
      standard,
      oapPlan,
      schedule,
      budget,
    );
    // NextResponse, not Response: the guard sets headers and rolls the session cookie on whatever
    // comes back, and a plain Response carries no cookies.
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": buildContentDisposition(
          getCourseOutlineFileName(course, schedule),
        ),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ไม่สามารถสร้าง Course Outline ได้",
      },
      { status: 500 },
    );
  }
}, { allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] });
