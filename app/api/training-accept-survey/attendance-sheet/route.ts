import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createProtectedRoute } from "../../../lib/auth/guard";
import {
  getAttendanceSheetFileName,
  type AttendanceSheetCourse,
  type AttendanceSheetParticipant,
} from "../../../lib/attendanceSheetExport";
import { buildAttendanceWorkbook } from "../../../lib/attendanceSheetWorkbook";

export const runtime = "nodejs";

type ExportRequest = {
  course?: AttendanceSheetCourse;
  participants?: AttendanceSheetParticipant[];
};

const findTemplatePath = async () => {
  const templateDirectory = path.join(process.cwd(), "app", "Excel");
  const fileNames = await readdir(templateDirectory);
  const templateName = fileNames.find(
    (name) =>
      name.startsWith("ATA-F-HD-004-") &&
      name.toLocaleLowerCase().endsWith("v2.xlsx"),
  );

  if (!templateName) {
    throw new Error("ไม่พบไฟล์ต้นแบบแบบลงทะเบียนการฝึกอบรม v2.xlsx");
  }

  return path.join(templateDirectory, templateName);
};

// Reads a template off disk and builds a workbook per request, so it stays behind the same guard
// as every other route: an unauthenticated caller could otherwise spin these up at will.
export const POST = createProtectedRoute(async (request) => {
  try {
    const payload = (await request.json()) as ExportRequest;
    const { course, participants } = payload;

    if (
      !course ||
      typeof course.code !== "string" ||
      typeof course.title !== "string" ||
      typeof course.date !== "string" ||
      !Array.isArray(participants) ||
      participants.some(
        (participant) =>
          !participant ||
          typeof participant.id !== "string" ||
          typeof participant.name !== "string" ||
          typeof participant.company !== "string" ||
          typeof participant.department !== "string" ||
          typeof participant.position !== "string",
      )
    ) {
      return NextResponse.json(
        { error: "ข้อมูลหลักสูตรหรือรายชื่อผู้เข้าอบรมไม่ครบถ้วน" },
        { status: 400 },
      );
    }

    const template = await readFile(await findTemplatePath());
    const workbook = buildAttendanceWorkbook(template, course, participants);

    const fileName = getAttendanceSheetFileName(course);
    const encodedFileName = encodeURIComponent(fileName);

    // NextResponse, not Response: the guard sets headers and rolls the session cookie on whatever
    // comes back, and a plain Response carries no cookies.
    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ Excel ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] });
