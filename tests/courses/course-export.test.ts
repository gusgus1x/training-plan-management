import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildCourseMasterExportWorkbook, type CourseExportRecord } from "../../app/lib/courseMasterExport";
import { readXlsxEntries } from "../../app/lib/xlsxTemplate";

describe("Course Master Excel Export", () => {
  it("builds a valid xlsx workbook based on Master Course Import Tem", async () => {
    const templatePath = path.join(process.cwd(), "app", "Excel", "Master Course Import Tem.xlsx");
    expect(fs.existsSync(templatePath)).toBe(true);

    const templateBuffer = fs.readFileSync(templatePath);
    const sampleCourses: CourseExportRecord[] = [
      {
        courseCode: "SAFE-001",
        courseNameTh: "ความปลอดภัยในการทำงาน 101",
        courseNameEn: "Safety at Work 101",
        courseGroup: "Safety",
        courseType: "ATA-TC",
        objective: "เพื่อความปลอดภัยในโรงงาน",
        learningContent: "1. กฎความปลอดภัย\n2. การใช้อุปกรณ์ป้องกัน",
        targetGroup: "พนักงานฝ่ายผลิต",
        methodology: "Workshop",
        levels: ["O1", "S1", "S2"],
      },
      {
        courseCode: "QUAL-002",
        courseNameTh: "การควบคุมคุณภาพขั้นพื้นฐาน",
        courseNameEn: "Basic Quality Control",
        courseGroup: "Quality",
        courseType: "Inhouse",
        objective: "ยกระดับคุณภาพชิ้นงาน",
        learningContent: "1. QC 7 Tools\n2. Kaizen",
        targetGroup: "หัวหน้างาน",
        methodology: "Lecture",
        levels: ["S3", "M1"],
      },
    ];

    const exportedBuffer = buildCourseMasterExportWorkbook(templateBuffer, sampleCourses);
    expect(exportedBuffer).toBeDefined();
    expect(exportedBuffer.length).toBeGreaterThan(1000);

    // Verify it is readable as xlsx entries
    const entries = readXlsxEntries(exportedBuffer);
    const sheetEntry = entries.find((e) => e.name === "xl/worksheets/sheet1.xml");
    expect(sheetEntry).toBeDefined();

    const sheetXml = sheetEntry!.data.toString("utf8");
    expect(sheetXml).toContain("SAFE-001");
    expect(sheetXml).toContain("ความปลอดภัยในการทำงาน 101");
    expect(sheetXml).toContain("QUAL-002");
    expect(sheetXml).toContain("การควบคุมคุณภาพขั้นพื้นฐาน");
    expect(sheetXml).toContain("A1:BU8");

    // Assert J and BB are empty, K and BU hold the data, and levels have checkmark '✓'
    expect(sheetXml).toContain('<c r="J7" s="17"/>');
    expect(sheetXml).toContain('<c r="K7" s="19" t="inlineStr"><is><t xml:space="preserve">ความปลอดภัยในการทำงาน 101</t></is></c>');
    expect(sheetXml).toContain('<c r="BB7" s="25"/>');
    expect(sheetXml).toContain('<c r="BU7" s="17" t="inlineStr"><is><t xml:space="preserve">ATA-TC</t></is></c>');
    expect(sheetXml).toContain('>✓<');

    // Test Round-trip: Feed exportedBuffer into parseXlsxBuffer (Import logic)
    const { parseXlsxBuffer } = await import("../../app/api/course-master/parse-template/route");
    const parsedRows = parseXlsxBuffer(exportedBuffer);

    expect(parsedRows.length).toBe(2);
    expect(parsedRows[0].courseCode).toBe("SAFE-001");
    expect(parsedRows[0].courseNameTh).toBe("ความปลอดภัยในการทำงาน 101");
    expect(parsedRows[0].courseGroup).toBe("Safety");
    expect(parsedRows[0].courseType).toBe("ATA-TC");
    expect(parsedRows[0].levels).toContain("O1");
    expect(parsedRows[0].levels).toContain("S1");
    expect(parsedRows[0].levels).toContain("S2");
    expect(parsedRows[0].learningContent).toContain("กฎความปลอดภัย");
    expect(parsedRows[0].objective).toContain("เพื่อความปลอดภัยในโรงงาน");

    expect(parsedRows[1].courseCode).toBe("QUAL-002");
    expect(parsedRows[1].courseNameTh).toBe("การควบคุมคุณภาพขั้นพื้นฐาน");
    expect(parsedRows[1].courseGroup).toBe("Quality");
    expect(parsedRows[1].courseType).toBe("Inhouse");
    expect(parsedRows[1].levels).toContain("S3");
    expect(parsedRows[1].levels).toContain("M1");
    expect(parsedRows[1].learningContent).toContain("QC 7 Tools");
    expect(parsedRows[1].objective).toContain("ยกระดับคุณภาพชิ้นงาน");
  });

  it("builds a zip archive containing separated company xlsx files", async () => {
    const templatePath = path.join(process.cwd(), "app", "Excel", "Master Course Import Tem.xlsx");
    const templateBuffer = fs.readFileSync(templatePath);

    const { buildCompanyCourseMasterExportZip } = await import("../../app/lib/courseMasterExport");

    const companyMap = new Map<string, CourseExportRecord[]>([
      [
        "CENTER",
        [
          {
            courseCode: "CEN-001",
            courseNameTh: "หลักสูตรส่วนกลาง",
            levels: ["O1"],
          },
        ],
      ],
      [
        "AT-A",
        [
          {
            courseCode: "AT-A-SAF-000001",
            courseNameTh: "หลักสูตรโรงงาน AT-A",
            levels: ["S1"],
          },
        ],
      ],
    ]);

    const zipBuffer = buildCompanyCourseMasterExportZip(templateBuffer, companyMap, "2026-09-02");
    expect(zipBuffer).toBeDefined();
    expect(zipBuffer.length).toBeGreaterThan(2000);

    const zipEntries = readXlsxEntries(zipBuffer);
    const entryNames = zipEntries.map((e) => e.name);
    expect(entryNames).toContain("Master_Course_CENTER_2026-09-02.xlsx");
    expect(entryNames).toContain("Master_Course_AT-A_2026-09-02.xlsx");

    // Verify inside each company xlsx that it contains the company's course
    const centerExcelEntry = zipEntries.find((e) => e.name === "Master_Course_CENTER_2026-09-02.xlsx");
    const centerInnerEntries = readXlsxEntries(centerExcelEntry!.data);
    const centerSheetXml = centerInnerEntries.find((e) => e.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    expect(centerSheetXml).toContain("CEN-001");
    expect(centerSheetXml).toContain("หลักสูตรส่วนกลาง");

    const ataExcelEntry = zipEntries.find((e) => e.name === "Master_Course_AT-A_2026-09-02.xlsx");
    const ataInnerEntries = readXlsxEntries(ataExcelEntry!.data);
    const ataSheetXml = ataInnerEntries.find((e) => e.name === "xl/worksheets/sheet1.xml")!.data.toString("utf8");
    expect(ataSheetXml).toContain("AT-A-SAF-000001");
    expect(ataSheetXml).toContain("หลักสูตรโรงงาน AT-A");
  });
});
