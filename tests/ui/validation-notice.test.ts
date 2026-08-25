import { describe, expect, it } from "vitest";
import { buildMissingFieldsMessage } from "../../app/lib/validationNotice";

describe("buildMissingFieldsMessage", () => {
  it("counts the fields and lists them as bullets in both languages", () => {
    const { title, message } = buildMissingFieldsMessage([
      "ชื่อหลักสูตร (Course Name)",
      "งบประมาณ (Budget)",
    ]);

    expect(title).toBe("ข้อมูลไม่ครบถ้วน / Incomplete information");
    expect(message).toContain("คุณยังไม่ได้กรอกข้อมูล 2 รายการ");
    expect(message).toContain("กรุณากรอกข้อมูลให้ครบตามที่กำหนด");
    expect(message).toContain("You have 2 required fields left.");
    expect(message).toContain("• ชื่อหลักสูตร (Course Name)");
    expect(message).toContain("• งบประมาณ (Budget)");
  });

  it("uses the singular English wording for a single field", () => {
    const { message } = buildMissingFieldsMessage(["งบประมาณ (Budget)"]);
    expect(message).toContain("You have 1 required field left.");
  });

  it("drops blank entries so they never inflate the count", () => {
    const { message } = buildMissingFieldsMessage(["งบประมาณ (Budget)", "  ", ""]);
    expect(message).toContain("คุณยังไม่ได้กรอกข้อมูล 1 รายการ");
    expect(message).not.toContain("• \n");
  });
});
