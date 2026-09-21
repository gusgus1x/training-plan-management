import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProtectedRoute } from "../../../../lib/auth/guard";
import { buildSectionWorkbook } from "../../../../lib/externalEvaluation/sectionWorkbook";
import type { SectionReport } from "../../../../lib/externalEvaluation/sections";

export const runtime = "nodejs";

/** The company's own evaluation workbook, laid out by the sections HRD named. */
const COMPANY_TEMPLATE_PATH = path.join(process.cwd(), "app", "Excel", "1. Evaluation Form.xlsx");

const xlsxResponse = (workbook: Buffer, name: string) => {
  const encodedFileName = encodeURIComponent(`Evaluation ${name}.xlsx`);
  return new NextResponse(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "no-store",
    },
  });
};

/**
 * The converter's report: the summary and replies the screen built from an uploaded file, written
 * into the same template as the in-system evaluation export.
 *
 * The body is the caller's own upload reshaped, so it is only checked for shape; every value lands
 * in the workbook through the builder's XML escaping.
 */
export const POST = createProtectedRoute(
  async (request: NextRequest) => {
    const report = (await request.json().catch(() => null))?.report as SectionReport | undefined;

    if (
      !report ||
      !report.course ||
      !Array.isArray(report.respondents) ||
      !Array.isArray(report.companies) ||
      !Array.isArray(report.sections) ||
      report.sections.some((section) => !Array.isArray(section?.questions))
    ) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ กรุณาอัปโหลดไฟล์ใหม่" }, { status: 400 });
    }
    if (!report.sections.length) {
      return NextResponse.json({ error: "ยังไม่มีคำถามที่ถูกจัดเข้า Section" }, { status: 400 });
    }

    const workbook = buildSectionWorkbook(await readFile(COMPANY_TEMPLATE_PATH), report);
    return xlsxResponse(workbook, report.course.courseName || "report");
  },
  { allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] },
);
