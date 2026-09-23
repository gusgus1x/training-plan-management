import { describe, expect, it } from "vitest";
import { splitLinks } from "../../app/components/LinkifiedText";

describe("splitLinks", () => {
  it("turns http(s) addresses into links and keeps the text around them", () => {
    expect(splitLinks("ลงทะเบียนที่ https://forms.office.com/r/abc123. แล้วดู http://x.co/a")).toEqual([
      { text: "ลงทะเบียนที่ " },
      { text: "https://forms.office.com/r/abc123", href: "https://forms.office.com/r/abc123" },
      { text: ". แล้วดู " },
      { text: "http://x.co/a", href: "http://x.co/a" },
    ]);
  });

  it("leaves text without an address, and non-http schemes, as plain text", () => {
    expect(splitLinks("ไม่มีลิงก์")).toEqual([{ text: "ไม่มีลิงก์" }]);
    expect(splitLinks("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
  });
});
