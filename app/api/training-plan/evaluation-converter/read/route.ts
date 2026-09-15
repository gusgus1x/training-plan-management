import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProtectedRoute } from "../../../../lib/auth/guard";
import { readResponseSheet } from "../../../../lib/externalEvaluation/readSheet";
import { readStandardSections } from "../../../../lib/externalEvaluation/sectionWorkbook";

const COMPANY_TEMPLATE = path.join(process.cwd(), "app", "Excel", "1. Evaluation Form.xlsx");

export const runtime = "nodejs";

/** A response export of a few thousand replies is well under this. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * An uploaded Google Forms / Microsoft Forms response file, read into rows for the converter screen.
 *
 * Nothing is kept: the file is read in memory and the rows go straight back. The .xlsx reader runs
 * here rather than in the browser because it is the Node zip reader the report export uses.
 */
export const POST = createProtectedRoute(
  async (request: NextRequest) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10 MB" }, { status: 400 });
    }
    try {
      const rows = readResponseSheet(file.name, Buffer.from(await file.arrayBuffer()));
      if (rows.length < 2) {
        return NextResponse.json({ error: "ไม่พบคำตอบในไฟล์ (ต้องมีหัวคอลัมน์และข้อมูลอย่างน้อย 1 แถว)" }, { status: 400 });
      }
      // The company template's own sections, so Advanced mode can group a standard form for HRD.
      const standardSections = readStandardSections(await readFile(COMPANY_TEMPLATE));
      return NextResponse.json({ fileName: file.name, rows, standardSections });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
    }
  },
  { allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] },
);
