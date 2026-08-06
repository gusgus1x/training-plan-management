import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { translateUiText } from "../../app/components/ThaiUiLocalization";

describe("Thai UI localization", () => {
  it("translates common labels and action buttons", () => {
    expect(translateUiText("Save")).toBe("บันทึก");
    expect(translateUiText("Delete")).toBe("ลบ");
    expect(translateUiText("Search")).toBe("ค้นหา");
    expect(translateUiText("Assessment Name")).toBe("ชื่อแบบทดสอบ");
  });

  it("preserves whitespace and translates dynamic counters", () => {
    expect(translateUiText("  12 records  ")).toBe("  12 รายการ  ");
    expect(translateUiText("3 questions")).toBe("3 คำถาม");
    expect(translateUiText("2 positions · 4 levels")).toBe(
      "2 ตำแหน่ง · 4 ระดับ",
    );
    expect(translateUiText("1 published Pre Test option")).toBe(
      "แบบทดสอบก่อนเรียนที่เผยแพร่แล้ว 1 รายการ",
    );
  });

  it("translates Course Master guidance placeholders and linked-form options", () => {
    expect(
      translateUiText(
        "Describe what learners should achieve after completing the course.",
      ),
    ).toBe("ระบุสิ่งที่ผู้เรียนต้องทำได้หลังจบหลักสูตร");
    expect(translateUiText("No Pre Test")).toBe(
      "ไม่ใช้แบบทดสอบก่อนเรียน",
    );
    expect(translateUiText("No 30-Day Evaluation")).toBe(
      "ไม่ใช้แบบประเมินติดตามผล 30 วัน",
    );
  });

  it("translates multi-session and company selection controls", () => {
    expect(translateUiText("Training sessions")).toBe("รอบการอบรม");
    expect(translateUiText("Add session")).toBe("เพิ่มรอบอบรม");
    expect(translateUiText("Session 2")).toBe("รอบอบรมที่ 2");
    expect(translateUiText("3 companies selected")).toBe(
      "เลือกแล้ว 3 บริษัท",
    );
    expect(translateUiText("2 sessions")).toBe("2 รอบอบรม");
    expect(translateUiText("Publish all")).toBe("เผยแพร่ทั้งหมด");
    expect(translateUiText("Training Session")).toBe("รอบการอบรม");
  });

  it("translates module headings, navigation, and role labels", () => {
    expect(translateUiText("Course Master")).toBe("ฐานข้อมูลหลักสูตร");
    expect(translateUiText("Course Master & Standard")).toBe(
      "ฐานข้อมูลและมาตรฐานหลักสูตร",
    );
    expect(translateUiText("Evaluation Management")).toBe("จัดการแบบประเมิน");
    expect(translateUiText("Back to Dashboard")).toBe("กลับหน้าหลัก");
    expect(translateUiText("Management")).toBe("ระดับบริหาร");
    expect(translateUiText("Operator")).toBe("พนักงานปฏิบัติการ");
  });

  it("translates combined workspace titles but preserves business names", () => {
    expect(
      translateUiText("Training Course Management / Course Master"),
    ).toBe("จัดการหลักสูตรอบรม / ฐานข้อมูลหลักสูตร");
    expect(translateUiText("Aisin Takaoka Foundry Bangpakong Co.,Ltd")).toBe(
      "Aisin Takaoka Foundry Bangpakong Co.,Ltd",
    );
  });

  it("translates center, factory, and employee dashboard copy", () => {
    expect(translateUiText("Center Workspace")).toBe("พื้นที่ทำงานส่วนกลาง");
    expect(translateUiText("Factory Dashboard")).toBe("แดชบอร์ดโรงงาน");
    expect(translateUiText("Training Roadmap")).toBe("แผนพัฒนาการอบรม");
    expect(translateUiText("Show month list")).toBe("แสดงรายการของเดือน");
    expect(translateUiText("Pending Approval")).toBe("รออนุมัติ");
    expect(translateUiText("Register Train")).toBe("ลงทะเบียนอบรม");
    expect(translateUiText("Waiting HRD approval")).toBe("รอ HRD อนุมัติ");
  });

  it("provides a persistent EN and TH switch in the navbar", () => {
    const navbarSource = readFileSync(
      join(process.cwd(), "app/components/Navbar.tsx"),
      "utf8",
    );
    const navbarStyles = readFileSync(
      join(process.cwd(), "app/components/Navbar.module.css"),
      "utf8",
    );
    const localizationSource = readFileSync(
      join(process.cwd(), "app/components/ThaiUiLocalization.tsx"),
      "utf8",
    );

    expect(navbarSource).toContain('setLanguage("en")');
    expect(navbarSource).toContain('setLanguage("th")');
    expect(navbarSource).toContain('aria-pressed={language === "th"}');
    expect(navbarSource).toContain("styles.languageDivider");
    expect(navbarSource).toContain('role="group"');
    expect(navbarStyles).toContain("min-width: 30px");
    expect(navbarStyles).toContain(".scrolledNavbar .languageSwitcher");
    expect(localizationSource).toContain(
      "window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage)",
    );
    expect(localizationSource).toContain(
      'Boolean(element?.closest("textarea"))',
    );
  });
});
