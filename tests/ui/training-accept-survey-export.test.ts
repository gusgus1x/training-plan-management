import { describe, expect, it } from "vitest";
import {
  buildAttendanceSheetHtml,
  getAttendanceSheetFileName,
} from "../../app/lib/attendanceSheetExport";

const course = {
  code: "CRS-001",
  title: "Leadership Essentials",
  date: "2026-08-15",
  batch: "Batch 1",
  location: "Training Room A",
  startTime: "09:00",
  endTime: "16:00",
  ownerCompany: "HRD Center",
};

describe("Training Accept Survey attendance sheet export", () => {
  it("builds a printable bilingual signature sheet from accepted participants", () => {
    const html = buildAttendanceSheetHtml(course, [
      {
        id: "ATA-1001",
        name: "Anan Sukprasert",
        company: "ATA",
        department: "Production",
        position: "Supervisor",
        prefix: "Mr.",
        firstName: "Anan",
        lastName: "Sukprasert",
      },
    ]);

    expect(html).toContain("ใบตรวจสอบการเข้าอบรม");
    expect(html).toContain("Training Attendance &amp; Signature Sheet");
    expect(html).toContain("Leadership Essentials");
    expect(html).toContain("ATA-1001");
    expect(html).toContain("Anan");
    expect(html).toContain("Sukprasert");
    expect(html).toContain("มาอบรม<br>Attend");
    expect(html).toContain("ไม่มา<br>Absent");
    expect(html).toContain("ลายเซ็น<br>Signature");
    expect(html).toContain("@page { size: A4 landscape;");
    expect(html).toContain("1 คน / people");
  });

  it("escapes spreadsheet values supplied by workflow data", () => {
    const html = buildAttendanceSheetHtml(
      { ...course, title: "<script>alert('course')</script>" },
      [
        {
          id: "EMP&001",
          name: "<Admin>",
          company: "A&B",
          department: "R&D",
          position: "\"Lead\"",
        },
      ],
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("EMP&amp;001");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("&quot;Lead&quot;");
  });

  it("creates a filesystem-safe Excel filename", () => {
    expect(
      getAttendanceSheetFileName({
        code: "CRS/001",
        date: "2026-08-15",
        batch: "Batch 1",
      }),
    ).toBe("attendance_CRS-001_2026-08-15_Batch-1.xls");
  });
});
