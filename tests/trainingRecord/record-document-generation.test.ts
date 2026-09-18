import { describe, expect, it } from "vitest";
import {
  COMPANY_LETTERHEADS,
  resolveCompanyLetterhead,
  type CompanyLetterheadCode,
} from "../../app/lib/trainingRecord/companyLetterheadConfig";
import {
  calculateWorkDuration,
  formatThaiDateFull,
  formatThaiDateShort,
} from "../../app/lib/trainingRecord/recordDocumentFormatters";
import { generateRecordHtml } from "../../app/lib/trainingRecord/recordDocumentGenerator";

describe("Company Letterhead Configuration", () => {
  const expectedCompanies: CompanyLetterheadCode[] = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];

  it("contains definitions for all 6 entities", () => {
    for (const code of expectedCompanies) {
      const config = COMPANY_LETTERHEADS[code];
      expect(config).toBeDefined();
      expect(config.code).toBe(code);
      expect(config.nameTh).toBeTruthy();
      expect(config.nameEn).toBeTruthy();
      expect(config.logoUrl).toContain(code.toLowerCase());
      expect(config.addressTh).toBeTruthy();
      expect(config.tel).toBeTruthy();
    }
  });

  it("resolves company code case-insensitively with fallbacks", () => {
    expect(resolveCompanyLetterhead("ata").code).toBe("ATA");
    expect(resolveCompanyLetterhead("AT-A").code).toBe("ATA");
    expect(resolveCompanyLetterhead("atfb").code).toBe("ATFB");
    expect(resolveCompanyLetterhead("NIC").code).toBe("NIC");
    expect(resolveCompanyLetterhead("sati").code).toBe("SATI");
    expect(resolveCompanyLetterhead("SNF").code).toBe("SNF");
    expect(resolveCompanyLetterhead("tep").code).toBe("TEP");
    expect(resolveCompanyLetterhead(null).code).toBe("ATA");
  });
});

describe("Record Document Formatters", () => {
  it("formats Thai short dates correctly", () => {
    // 18 July 1992 (2535 BE)
    const date1 = new Date(1992, 6, 18);
    expect(formatThaiDateShort(date1)).toBe("18 ก.ค. 35");

    // 14 June 1994 (2537 BE)
    const date2 = new Date(1994, 5, 14);
    expect(formatThaiDateShort(date2)).toBe("14 มิ.ย. 37");
  });

  it("formats Thai full dates correctly", () => {
    const date = new Date(1982, 3, 16);
    expect(formatThaiDateFull(date)).toBe("16 เมษายน 2525");
  });

  it("calculates work duration in years and months", () => {
    const startDate = new Date(1982, 3, 16); // 16 April 1982
    const refDate = new Date(2019, 11, 20); // Dec 2019
    const duration = calculateWorkDuration(startDate, refDate);
    expect(duration).toContain("37 ปี");
    expect(duration).toContain("8 เดือน");
  });
});

describe("Record Document HTML Generation", () => {
  it("generates complete HTML document with all components matching sample", () => {
    const mockEmployee = {
      employeeCode: "1290-000063",
      nameTh: "นริศสา ศิลปะพิบูรย์",
      positionName: "ผู้จัดการบริหารทั่วไป",
      departmentName: "ฝ่ายฝึกอบรม",
      workday: "1982-04-16",
      companyCode: "ATA",
    };

    const mockCourses = [
      {
        courseCode: "ISO-9000",
        courseTitle: "ระบบคุณภาพ ISO 9000",
        startDate: "1992-07-18",
        completedDate: "1992-07-18",
        instructor: "สนง.บค.ก/คฟ.",
      },
      {
        courseCode: "MDP-01",
        courseTitle: "MDP",
        startDate: "1994-06-14",
        completedDate: "1994-11-12",
        instructor: "สนง.บค.ก/คฟ.",
      },
    ];

    const html = generateRecordHtml(mockEmployee, mockCourses, "ATA", {
      requestNo: "TRR-202609-000001",
      approvedBy: "ผู้จัดการแผนก",
    });

    expect(html).toContain("บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด");
    expect(html).toContain("AISIN TAKAOKA ASIA CO., LTD.");
    expect(html).toContain("ประวัติการฝึกอบรม");
    expect(html).toContain("1290-000063");
    expect(html).toContain("นริศสา ศิลปะพิบูรย์");
    expect(html).toContain("ผู้จัดการบริหารทั่วไป");
    expect(html).toContain("ระบบคุณภาพ ISO 9000");
    expect(html).toContain("สนง.บค.ก/คฟ.");
    expect(html).toContain("TRR-202609-000001");
    expect(html).toContain("รวมทั้งสิ้น <span class=\"summary-count\">2</span> หลักสูตร");
  });
});
