import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  try {
    const { course, standard, oapPlan } =
      (await request.json()) as CourseOutlineRequest;
    if (!course || !course.courseCode || !course.courseNameTh) {
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
    );
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getCourseOutlineFileName(course)}"`,
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
}
