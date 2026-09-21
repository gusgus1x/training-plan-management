import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  COMPANY_LETTERHEADS,
  type CompanyLetterheadCode,
  resolveCompanyLetterhead,
} from "../../app/lib/trainingRecord/companyLetterheadConfig";
import {
  formatThaiDateFull,
  formatThaiDateShort,
  calculateWorkDuration,
} from "../../app/lib/trainingRecord/recordDocumentFormatters";
import {
  buildDocxBodyXml,
  buildFullDocumentXml,
  generateTrainingRecordDocx,
  extractPageUsableWidth,
  DEFAULT_COMPANY_USABLE_WIDTHS,
  SAMPLE_EMPLOYEE_DATA,
  SAMPLE_COURSES_DATA,
  SAMPLE_MULTIPAGE_COURSES_DATA,
} from "../../app/lib/trainingRecord/recordDocxGenerator";

describe("Training Record Word (.docx) Document Generation", () => {
  it("has valid template files in app/Word for all 6 companies", () => {
    const companies: CompanyLetterheadCode[] = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];

    for (const code of companies) {
      const info = COMPANY_LETTERHEADS[code];
      expect(info).toBeDefined();
      expect(info.templateFileName).toBeDefined();

      const templatePath = path.join(process.cwd(), "app", "Word", info.templateFileName);
      expect(fs.existsSync(templatePath)).toBe(true);
      expect(fs.statSync(templatePath).size).toBeGreaterThan(1000);
    }
  });

  it("resolves company letterheads accurately", () => {
    expect(resolveCompanyLetterhead("ATA").code).toBe("ATA");
    expect(resolveCompanyLetterhead("AT-A").code).toBe("ATA");
    expect(resolveCompanyLetterhead("ATFB").code).toBe("ATFB");
    expect(resolveCompanyLetterhead("NIC").code).toBe("NIC");
    expect(resolveCompanyLetterhead("SATI").code).toBe("SATI");
    expect(resolveCompanyLetterhead("SNF").code).toBe("SNF");
    expect(resolveCompanyLetterhead("TEP").code).toBe("TEP");
    expect(resolveCompanyLetterhead("UNKNOWN").code).toBe("ATA");
  });

  it("formats Thai dates and calculates work duration correctly according to ตัวอย่าง.pdf", () => {
    // Check 16 เมษายน 2525
    expect(formatThaiDateFull("1982-04-16")).toBe("16 เมษายน 2525");
    // Check short date: 18 ก.ค. 35
    expect(formatThaiDateShort("1992-07-18")).toBe("18 ก.ค. 35");
    // Check duration
    const refDate = new Date(2019, 11, 16); // Dec 2019
    expect(calculateWorkDuration("1982-04-16", refDate)).toBe("37 ปี 8 เดือน");
  });

  it("builds valid OpenXML body with title, metadata table, and course rows", () => {
    const bodyXml = buildDocxBodyXml(SAMPLE_EMPLOYEE_DATA, SAMPLE_COURSES_DATA);

    expect(bodyXml).toContain("ประวัติการฝึกอบรม");
    expect(bodyXml).toContain("รหัสพนักงาน");
    expect(bodyXml).toContain("1290-000063");
    expect(bodyXml).toContain("นริศสา ศิลปะพิบูรย์");
    expect(bodyXml).toContain("ผู้จัดการบริหารทั่วไป");
    expect(bodyXml).toContain("16 เมษายน 2525");
    expect(bodyXml).toContain("รวมทั้งสิ้น");
    expect(bodyXml).toContain("3");
    expect(bodyXml).toContain("หลักสูตร ดังนี้");
    expect(bodyXml).toContain("ระบบคุณภาพ ISO 9000");
    expect(bodyXml).toContain("18 ก.ค. 35");
    expect(bodyXml).toContain("<w:tblHeader/>");
    // Verify both tables have center alignment (<w:jc w:val="center"/>)
    expect(bodyXml).toContain('<w:jc w:val="center"/>');
    expect(bodyXml).toContain('<w:gridCol');
  });

  it("calculates page usable width accurately from sectPr XML", () => {
    // SATI: 11907 - 1440 - 1440 = 9027
    const satiSectPr = '<w:sectPr><w:pgSz w:w="11907" w:h="16840"/><w:pgMar w:left="1440" w:right="1440"/></w:sectPr>';
    expect(extractPageUsableWidth(satiSectPr)).toBe(9027);

    // AT-A: 11907 - 284 - 708 = 10915
    const ataSectPr = '<w:sectPr><w:pgSz w:w="11907" w:h="16840"/><w:pgMar w:left="284" w:right="708"/></w:sectPr>';
    expect(extractPageUsableWidth(ataSectPr)).toBe(10915);

    // Fallback when sectPr is empty
    expect(extractPageUsableWidth("", 9027)).toBe(9027);
    expect(DEFAULT_COMPANY_USABLE_WIDTHS.SATI).toBe(9027);
    expect(DEFAULT_COMPANY_USABLE_WIDTHS.ATFB).toBe(9497);
  });

  it("scales table widths and column grids dynamically based on targetWidth", () => {
    const satiXml = buildDocxBodyXml(SAMPLE_EMPLOYEE_DATA, SAMPLE_COURSES_DATA, 9027);
    expect(satiXml).toContain('<w:tblW w:w="9027" w:type="dxa"/>');
    expect(satiXml).toContain('<w:gridCol w:w="4875"/>');
    expect(satiXml).toContain('<w:gridCol w:w="4152"/>');

    const ataXml = buildDocxBodyXml(SAMPLE_EMPLOYEE_DATA, SAMPLE_COURSES_DATA, 10915);
    expect(ataXml).toContain('<w:tblW w:w="10915" w:type="dxa"/>');
  });

  it("generates real docx buffers for all 6 companies without error", async () => {
    const companies: CompanyLetterheadCode[] = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];

    for (const code of companies) {
      const res = await generateTrainingRecordDocx({
        companyCode: code,
        isTest: true,
      });

      expect(res.companyCode).toBe(code);
      expect(res.fileName).toContain(`ประวัติการฝึกอบรม_`);
      expect(res.fileName).toContain(`นริศสา ศิลปะพิบูรย์`);
      expect(res.fileName.endsWith(".docx")).toBe(true);
      expect(res.buffer.length).toBeGreaterThan(10000);

      // Verify it is a valid zip archive (starts with PK\x03\x04)
      expect(res.buffer[0]).toBe(0x50); // P
      expect(res.buffer[1]).toBe(0x4b); // K
      expect(res.buffer[2]).toBe(0x03);
      expect(res.buffer[3]).toBe(0x04);
    }
  }, 60000);

  it("generates multi-page docx with 43 courses matching ตัวอย่าง.pdf and cantSplit tags", async () => {
    expect(SAMPLE_MULTIPAGE_COURSES_DATA.length).toBe(43);

    const res = await generateTrainingRecordDocx({
      companyCode: "ATA",
      isMultiPage: true,
    });

    expect(res.fileName).toContain("ตัวอย่างหลายหน้า_43หลักสูตร");
    expect(res.buffer.length).toBeGreaterThan(15000);

    const bodyXml = buildDocxBodyXml(SAMPLE_EMPLOYEE_DATA, SAMPLE_MULTIPAGE_COURSES_DATA, 10915);
    expect(bodyXml).toContain("<w:cantSplit/>");
    expect(bodyXml).toContain("<w:tblHeader/>");
    expect(bodyXml).toContain("43");
    expect(bodyXml).toContain("SDC (Safety Driving for Car)");
    // 43 items with 20 per page should result in exactly 2 page breaks (3 pages: 20 + 20 + 3)
    const pageBreaks = bodyXml.match(/<w:br w:type="page"\/>/g);
    expect(pageBreaks?.length).toBe(2);
    // Verify font size 15pt content (30 half-points) and 17pt title (34 half-points)
    expect(bodyXml).toContain('<w:sz w:val="30"/>');
    expect(bodyXml).toContain('<w:sz w:val="34"/>');
  });

  it("applies the exact same 20 items/page and 15pt font layout standard across all 6 companies", () => {
    const companies: CompanyLetterheadCode[] = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];

    for (const code of companies) {
      const usableWidth = DEFAULT_COMPANY_USABLE_WIDTHS[code];
      const xml = buildDocxBodyXml(SAMPLE_EMPLOYEE_DATA, SAMPLE_MULTIPAGE_COURSES_DATA, usableWidth);

      // Centered tables
      expect(xml).toContain('<w:jc w:val="center"/>');
      // 15pt font (sz=30)
      expect(xml).toContain('<w:sz w:val="30"/>');
      // 17pt bold title (sz=34)
      expect(xml).toContain('<w:sz w:val="34"/>');
      // 20 items per page means 43 items gives 2 page breaks (3 pages)
      const breaks = xml.match(/<w:br w:type="page"\/>/g);
      expect(breaks?.length).toBe(2);
      // Table header repeated on page splits
      expect(xml).toContain("<w:tblHeader/>");
      expect(xml).toContain("<w:cantSplit/>");
      // Date and sequence columns have noWrap to prevent 2-line break across all companies
      expect(xml).toContain("<w:noWrap/>");
    }
  });
});
