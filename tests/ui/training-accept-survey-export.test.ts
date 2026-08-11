import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  getAttendanceSheetFileName,
  localizeAndSortAttendanceParticipants,
} from "../../app/lib/attendanceSheetExport";
import {
  buildAttendanceWorkbook,
  readXlsxEntry,
} from "../../app/lib/attendanceSheetWorkbook";

const course = {
  code: "CRS-001",
  title: "หลักสูตรภาวะผู้นำ Leadership Essentials",
  date: "2026-08-15",
  batch: "Batch 1",
  location: "Training Room A",
  startTime: "09:00",
  endTime: "16:00",
  trainer: "Somchai P.",
  ownerCompany: "HRD Center",
};

let template: Buffer;

beforeAll(async () => {
  const templateDirectory = path.join(process.cwd(), "app", "Excel");
  const templateName = (await readdir(templateDirectory)).find(
    (name) =>
      name.startsWith("ATA-F-HD-004-") &&
      name.toLocaleLowerCase().endsWith("v2.xlsx"),
  );

  if (!templateName) {
    throw new Error("Attendance sheet v2 template was not found.");
  }
  template = await readFile(path.join(templateDirectory, templateName));
});

describe("Training Accept Survey attendance sheet export", () => {
  it("fills accepted participants into the real v2 Excel template", () => {
    const workbook = buildAttendanceWorkbook(template, course, [
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
    const worksheetXml = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet1.xml",
    ).toString("utf8");
    const stylesXml = readXlsxEntry(workbook, "xl/styles.xml").toString("utf8");

    expect(workbook.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(worksheetXml).toContain("หลักสูตรภาวะผู้นำ Leadership Essentials");
    expect(worksheetXml).toContain("พ.ศ. 2569");
    expect(worksheetXml).toContain("Somchai P.");
    expect(worksheetXml).toContain("ATA-1001");
    expect(worksheetXml).toContain("Anan");
    expect(worksheetXml).toContain("Sukprasert");
    expect(stylesXml).toMatch(
      /<xf\b[^>]*fontId="5"[^>]*applyAlignment="1"[^>]*><alignment horizontal="center" vertical="center"\/><\/xf>/,
    );
    expect(worksheetXml).toContain('<c r="B12"');
    expect(worksheetXml).toMatch(
      /<c r="B12" s="\d+" t="inlineStr"><is><t xml:space="preserve"><\/t>/,
    );
  });

  it("escapes XML values supplied by workflow data", () => {
    const workbook = buildAttendanceWorkbook(
      template,
      { ...course, title: "Safety & <Quality>" },
      [
        {
          id: "EMP&001",
          name: "<Admin>",
          company: "A&B",
          department: "R&D",
          position: '\"Lead\"',
        },
      ],
    );
    const worksheetXml = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet1.xml",
    ).toString("utf8");

    expect(worksheetXml).not.toContain("Safety & <Quality>");
    expect(worksheetXml).toContain("Safety &amp; &lt;Quality&gt;");
    expect(worksheetXml).toContain("EMP&amp;001");
    expect(worksheetXml).toContain("A&amp;B");
    expect(worksheetXml).toContain("&quot;Lead&quot;");
  });

  it("splits more than 50 participants into complete 30-row template sheets", () => {
    const participants = Array.from({ length: 65 }, (_, index) => ({
      id: `EMP-${index + 1}`,
      name: `Employee ${index + 1}`,
      company: "ATA",
      department: "Production",
      position: "Staff",
    }));
    const workbook = buildAttendanceWorkbook(template, course, participants);
    const workbookXml = readXlsxEntry(workbook, "xl/workbook.xml").toString(
      "utf8",
    );
    const secondSheetXml = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet2.xml",
    ).toString("utf8");
    const thirdSheetXml = readXlsxEntry(
      workbook,
      "xl/worksheets/sheet3.xml",
    ).toString("utf8");

    expect(workbookXml).toContain('name="รายชื่อ 1-30"');
    expect(workbookXml).toContain('name="รายชื่อ 31-60"');
    expect(workbookXml).toContain('name="รายชื่อ 61-65"');
    expect(secondSheetXml).not.toContain("หน้า 2/3");
    expect(secondSheetXml).not.toContain("หน้า 1/3");
    expect(secondSheetXml).toContain("EMP-31");
    expect(secondSheetXml).toContain(
      '<c r="B11" s="13" t="inlineStr"><is><t xml:space="preserve">31</t>',
    );
    expect(thirdSheetXml).toContain("EMP-65");
    expect(() =>
      readXlsxEntry(workbook, "xl/drawings/drawing3.xml"),
    ).not.toThrow();
    expect(() =>
      readXlsxEntry(
        workbook,
        "xl/printerSettings/printerSettings3.bin",
      ),
    ).not.toThrow();
  });

  it("uses Thai employee and position master data and sorts future companies", () => {
    const participants = [
      {
        id: "ZZZ-2",
        name: "Second Employee",
        company: "ZZZ",
        department: "Production",
        position: "Engineer",
      },
      {
        id: "NEWCO-10",
        name: "New Employee",
        company: "NEWCO",
        department: "Quality",
        position: "Supervisor",
      },
      {
        id: "NEWCO-2",
        name: "Earlier Employee",
        company: "NEWCO",
        department: "Quality",
        position: "Engineer",
      },
    ];
    const localized = localizeAndSortAttendanceParticipants(
      participants,
      [
        {
          empCode: "NEWCO-2",
          company: "NEWCO",
          nameTh: "สมชาย",
          surnameTh: "ใจดี",
          titleEn: "Mr.",
          functionName: "Quality",
          positionName: "Engineer",
        },
      ],
      [
        { positionNameEn: "Engineer", positionNameTh: "วิศวกร" },
        { positionNameEn: "Supervisor", positionNameTh: "หัวหน้างาน" },
      ],
    );

    expect(localized.map((participant) => participant.id)).toEqual([
      "NEWCO-2",
      "NEWCO-10",
      "ZZZ-2",
    ]);
    expect(localized[0]).toMatchObject({
      prefix: "นาย",
      firstName: "สมชาย",
      lastName: "ใจดี",
      name: "สมชาย ใจดี",
      position: "วิศวกร",
    });
    expect(localized[1].position).toBe("หัวหน้างาน");
    expect(localized[2].position).toBe("วิศวกร");
  });

  it("uses the compact Thai female title that fits the template column", () => {
    const [participant] = localizeAndSortAttendanceParticipants(
      [
        {
          id: "ATA-1002",
          name: "Mali Kasemsuk",
          company: "ATA",
          department: "Quality",
          position: "Engineer",
        },
      ],
      [
        {
          empCode: "ATA-1002",
          company: "ATA",
          nameTh: "มาลี",
          surnameTh: "เกษมสุข",
          titleEn: "Ms.",
          functionName: "Quality",
          positionName: "Engineer",
        },
      ],
      [{ positionNameEn: "Engineer", positionNameTh: "วิศวกร" }],
    );

    expect(participant.prefix).toBe("น.ส.");
  });

  it("keeps the English position when Position Master has no Thai translation", () => {
    const [participant] = localizeAndSortAttendanceParticipants(
      [
        {
          id: "NEWCO-1",
          name: "New Employee",
          company: "NEWCO",
          department: "Digital",
          position: "Data Specialist",
        },
      ],
      [],
      [
        {
          positionNameEn: "Data Specialist",
          positionNameTh: "",
        },
      ],
    );

    expect(participant.position).toBe("Data Specialist");
  });

  it("keeps Foreman and Leader in English by business convention", () => {
    const localized = localizeAndSortAttendanceParticipants(
      [
        {
          id: "ATA-1",
          name: "Employee One",
          company: "ATA",
          department: "Production",
          position: "Foreman",
        },
        {
          id: "ATA-2",
          name: "Employee Two",
          company: "ATA",
          department: "Production",
          position: "Leader",
        },
      ],
      [],
      [
        { positionNameEn: "Foreman", positionNameTh: "โฟร์แมน" },
        { positionNameEn: "Leader", positionNameTh: "ลีดเดอร์" },
      ],
    );

    expect(localized.map((participant) => participant.position)).toEqual([
      "Foreman",
      "Leader",
    ]);
  });

  it("creates a filesystem-safe real Excel filename with course code, date, and time", () => {
    expect(
      getAttendanceSheetFileName({
        code: "CRS/001",
        date: "2026-08-15",
        startTime: "09:00",
        endTime: "16:00",
        batch: "Batch 1",
      }),
    ).toBe("ใบลงทะเบียน CRS-001 2026-08-15 09.00-16.00.xlsx");
  });
});
