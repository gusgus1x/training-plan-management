import { describe, expect, it } from "vitest";
import {
  buildScheduleCalendarWorkbook,
  parseCalendarExportInput,
  type CalendarExportInput,
} from "../../app/lib/scheduleCalendarWorkbook";
import { readXlsxEntries } from "../../app/lib/xlsxTemplate";

const week = (first: number, segments: CalendarExportInput["months"][number]["weeks"][number]["segments"] = []) => ({
  days: Array.from({ length: 7 }, (_, i) => ({ dayNumber: first + i, isCurrentMonth: true })),
  segments,
});

const september: CalendarExportInput = {
  year: 2026,
  months: [
    {
      month: 9,
      weeks: [
        week(6, [
          { startCol: 2, span: 3, slot: 0, courseName: "Safety & <Basic>", companyKey: "TEP", continuesFromPrev: false, continuesToNext: false },
          { startCol: 5, span: 1, slot: 1, courseName: "Basic QCC", companyKey: "ATA", continuesFromPrev: false, continuesToNext: true },
        ]),
      ],
    },
  ],
  rows: [{ month: "September", date: "2026-09-08", courseCode: "OT-000001", courseName: "Safety", time: "08:00-17:00", company: "TEP" }],
};

const text = (workbook: Buffer, name: string) =>
  readXlsxEntries(workbook).find((entry) => entry.name === name)!.data.toString("utf8");

describe("buildScheduleCalendarWorkbook", () => {
  it("writes one sheet per month plus the flat list", () => {
    const workbook = buildScheduleCalendarWorkbook(september);
    const book = text(workbook, "xl/workbook.xml");
    expect(book).toContain('name="09 กันยายน"');
    expect(book).toContain('name="รายการ"');
    expect(readXlsxEntries(workbook).filter((entry) => entry.name.startsWith("xl/worksheets/"))).toHaveLength(2);
  });

  it("gives a full year 13 sheets", () => {
    const year = { ...september, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, weeks: [week(1)] })) };
    expect(readXlsxEntries(buildScheduleCalendarWorkbook(year)).filter((entry) => entry.name.startsWith("xl/worksheets/"))).toHaveLength(13);
  });

  it("merges a 3-day bar across 3 day columns and escapes its label", () => {
    const sheet = text(buildScheduleCalendarWorkbook(september), "xl/worksheets/sheet1.xml");
    // Tuesday..Thursday = columns D..F; first bar row sits under the day-number row 5
    expect(sheet).toContain('<mergeCell ref="D6:F6"/>');
    expect(sheet).toContain("Safety &amp; &lt;Basic&gt;  TEP");
    expect(sheet).toContain("Basic QCC  ATA ▶");
    expect(sheet).toContain("อาทิตย์");
  });

  it("keeps every style index the sheets use inside cellXfs", () => {
    const workbook = buildScheduleCalendarWorkbook(september);
    const count = Number(/<cellXfs count="(\d+)"/.exec(text(workbook, "xl/styles.xml"))![1]);
    const used = [...text(workbook, "xl/worksheets/sheet1.xml").matchAll(/ s="(\d+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...used)).toBeLessThan(count);
  });
});

describe("parseCalendarExportInput", () => {
  it("accepts the page's payload", () => {
    expect(parseCalendarExportInput(JSON.parse(JSON.stringify(september))).months[0].weeks[0].segments).toHaveLength(2);
  });

  it("rejects a bar that runs past Saturday and an out-of-range month", () => {
    const bad = JSON.parse(JSON.stringify(september));
    bad.months[0].weeks[0].segments[0].span = 6;
    expect(() => parseCalendarExportInput(bad)).toThrow("span");
    expect(() => parseCalendarExportInput({ ...september, months: [{ month: 13, weeks: [] }] })).toThrow("month");
  });

  it("falls back to ALL for an unknown company", () => {
    const odd = JSON.parse(JSON.stringify(september));
    odd.months[0].weeks[0].segments[0].companyKey = "XYZ";
    expect(parseCalendarExportInput(odd).months[0].weeks[0].segments[0].companyKey).toBe("ALL");
  });
});
