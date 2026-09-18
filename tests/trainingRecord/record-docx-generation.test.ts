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
  SAMPLE_EMPLOYEE_DATA,
  SAMPLE_COURSES_DATA,
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
  });

  it("generates real docx buffers for all 6 companies without error", async () => {
    const companies: CompanyLetterheadCode[] = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];

    for (const code of companies) {
      const res = await generateTrainingRecordDocx({
        companyCode: code,
        isTest: true,
      });

      expect(res.companyCode).toBe(code);
      expect(res.fileName).toContain(`ประวัติการฝึกอบรม_${code}`);
      expect(res.fileName.endsWith(".docx")).toBe(true);
      expect(res.buffer.length).toBeGreaterThan(10000);

      // Verify it is a valid zip archive (starts with PK\x03\x04)
      expect(res.buffer[0]).toBe(0x50); // P
      expect(res.buffer[1]).toBe(0x4b); // K
      expect(res.buffer[2]).toBe(0x03);
      expect(res.buffer[3]).toBe(0x04);
    }
  }, 60000);
});
