import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyseSheet } from "../../app/lib/externalEvaluation/convert";
import { parseCsv, readResponseSheet } from "../../app/lib/externalEvaluation/readSheet";
import { readXlsxEntries, setCell } from "../../app/lib/xlsxTemplate";
import { buildSectionReport } from "../../app/lib/externalEvaluation/sections";
import { buildSectionWorkbook } from "../../app/lib/externalEvaluation/sectionWorkbook";
import type { EvaluationCourseHeader } from "../../app/lib/trainingForms/types";

// Made-up rows in the shape each service exports. No real respondent data.
const microsoftSheet = [
  ["ID", "Start time", "Completion time", "Email", "Name", "Last modified time", "ชื่อ", "นามสกุล", "รหัสประจำตัวพนักงาน (4 ตัวสุดท้าย)", "บริษัท", "ความพึงพอใจโดยรวม", "หัวข้อที่สนใจ", "ข้อเสนอแนะ"],
  ["1", "46241.5", "46241.5025", "anonymous", "", "", "สมชาย", "ทดสอบ", "0001", "ATA", "5", "Excel;Power BI;", "ดีมาก ได้ความรู้เพิ่มเติมเยอะมากครับ"],
  ["2", "46241.51", "46241.5125", "anonymous", "", "", "สมหญิง", "ตัวอย่าง", "0002", "TEP", "4", "Excel;", "เนื้อหาเข้าใจง่าย อยากให้มีตัวอย่างเพิ่มขึ้นอีกหน่อย"],
  ["3", "46241.52", "46241.5225", "anonymous", "", "", "สมศักดิ์", "ลองดู", "0003", "ATA", "4", "Power BI;", "ระยะเวลาเหมาะสมดีแล้ว ขอบคุณวิทยากรครับ"],
];

const googleCsv = [
  "Timestamp,Email address,บริษัท,Overall rating,Preferred format,Comments",
  '9/14/2026 10:00:00,a@example.com,ATA,5,Online,"Great, very clear"',
  '9/14/2026 10:05:00,b@example.com,SNF,3,Onsite,"Line one',
  'line two"',
  "9/14/2026 10:10:00,c@example.com,ATA,4,Online,",
  "9/14/2026 10:15:00,d@example.com,TEP,4,Onsite,",
].join("\r\n");

const course: EvaluationCourseHeader = {
  planCode: "",
  courseName: "Test course",
  batchName: null,
  startAt: "",
  endAt: "",
  venue: null,
  instructor: null,
  organiser: "CENTER",
};

describe("reading response files", () => {
  it("keeps quoted commas and line breaks inside one CSV cell", () => {
    const rows = parseCsv(googleCsv);
    expect(rows).toHaveLength(5);
    expect(rows[1][5]).toBe("Great, very clear");
    expect(rows[2][5]).toBe("Line one\r\nline two");
  });

  it("rejects anything but .xlsx and .csv", () => {
    expect(() => readResponseSheet("answers.pdf", Buffer.from(""))).toThrow();
  });
});

describe("Microsoft Forms export", () => {
  const analysis = analyseSheet(microsoftSheet);
  const roleOf = (header: string) => analysis.columns.find((column) => column.header === header)?.role;

  it("recognises the service and every identity column", () => {
    expect(analysis.source).toBe("MICROSOFT");
    expect(roleOf("ID")).toBe("SKIP");
    expect(roleOf("Start time")).toBe("STARTED_AT");
    expect(roleOf("Completion time")).toBe("SUBMITTED_AT");
    expect(roleOf("ชื่อ")).toBe("FIRST_NAME");
    expect(roleOf("นามสกุล")).toBe("LAST_NAME");
    expect(roleOf("รหัสประจำตัวพนักงาน (4 ตัวสุดท้าย)")).toBe("EMPLOYEE_CODE");
    expect(roleOf("บริษัท")).toBe("COMPANY");
  });

  it("guesses rating, multi-select and written questions from the answers", () => {
    expect(roleOf("ความพึงพอใจโดยรวม")).toBe("RATING");
    expect(roleOf("หัวข้อที่สนใจ")).toBe("MULTI_CHOICE");
    expect(roleOf("ข้อเสนอแนะ")).toBe("TEXT");
  });

  it("reads a rating column's scale from its own answers", () => {
    const scaled = analyseSheet([
      ["Timestamp", "คะแนนเต็มสิบ", "คะแนนเต็มห้า"],
      ["9/14/2026 10:00:00", "9", "4"],
      ["9/14/2026 10:05:00", "7", "5"],
    ]);
    const column = (header: string) => scaled.columns.find((item) => item.header === header);
    expect(column("คะแนนเต็มสิบ")).toMatchObject({ role: "RATING", scale: 10 });
    expect(column("คะแนนเต็มห้า")).toMatchObject({ role: "RATING", scale: 5 });
  });
});

describe("Google Forms export", () => {
  const analysis = analyseSheet(parseCsv(googleCsv));

  it("recognises the service and the question columns", () => {
    expect(analysis.source).toBe("GOOGLE");
    const roles = analysis.columns.map((column) => column.role);
    expect(roles).toContain("RATING");
    expect(roles).toContain("CHOICE");
    expect(roles).toContain("TEXT");
  });
});

describe("Advanced mode: sections", () => {
  const template = readFileSync("app/Excel/1. Evaluation Form.xlsx");

  it("averages each rating and keeps written answers in respondent order", () => {
    const analysis = analyseSheet(microsoftSheet);
    const sections = [{ id: "a", name: "Part 2 : ความพึงพอใจ" }, { id: "b", name: "Part 3 : ความคิดเห็น" }];
    const assignment = { 10: "a", 12: "b" };
    const report = buildSectionReport(analysis, sections, assignment, course);
    expect(report.sections.map((section) => section.name)).toEqual(["Part 2 : ความพึงพอใจ", "Part 3 : ความคิดเห็น"]);
    expect(report.sections[0].questions[0].average).toBe(4.33);
    expect(report.sections[1].questions[0].answers).toHaveLength(3);
    expect(report.respondents[0]).toMatchObject({ firstName: "สมชาย", lastName: "ทดสอบ", employeeCode: "0001", companyCode: "ATA" });
    expect(report.companies).toEqual([{ companyCode: "ATA", count: 2 }, { companyCode: "TEP", count: 1 }]);
  });

  it("charts a choice column and puts a grid's columns back together", () => {
    const sheet = [
      ["Timestamp", "หัวข้อที่สนใจ", "ความพึงพอใจ [วิทยากร]", "ความพึงพอใจ [สถานที่]"],
      ["9/14/2026 10:00:00", "Excel;Power BI;", "ดี", "พอใช้"],
      ["9/14/2026 10:05:00", "Excel;", "ดี", "ดี"],
    ];
    const analysis = analyseSheet(sheet);
    const report = buildSectionReport(analysis, [{ id: "a", name: "Part 1" }], { 1: "a", 2: "a", 3: "a" }, course);
    const [choice, grid] = report.sections[0].questions;

    expect(choice).toMatchObject({ header: "หัวข้อที่สนใจ", kind: "CHOICE" });
    // Two people, both ticked Excel, one also Power BI: shares of the people, not of the ticks.
    expect(choice.split).toEqual([
      { label: "Excel", percent: 100 },
      { label: "Power BI", percent: 50 },
    ]);

    expect(grid).toMatchObject({ header: "ความพึงพอใจ", kind: "GRID" });
    expect(grid.gridSplit?.rows).toEqual(["วิทยากร", "สถานที่"]);
    expect(grid.gridSplit?.columns).toEqual(["ดี", "พอใช้"]);
    expect(grid.gridSplit?.percent).toEqual([[100, 0], [50, 50]]);
    // The raw sheet still reads per person, row by row.
    expect(grid.answers[0]).toBe("วิทยากร: ดี; สถานที่: พอใช้");
  });

  it("draws every section, growing each chart with its questions and breaking the page between them", () => {
    // What the old three-section, ten-question limit refused: five sections of fifteen ratings.
    const section = (name: string, ratings: number) => ({
      name,
      questions: Array.from({ length: ratings }, (_, index) => ({
        header: `q${index}`,
        kind: "RATING" as const,
        answers: [4],
        average: 4,
      })),
    });
    const report = {
      course,
      respondents: [{ timestamp: null, firstName: "a", lastName: "b", employeeCode: "1", companyCode: "ATA" }],
      companies: [{ companyCode: "ATA", count: 1 }],
      sections: Array.from({ length: 5 }, (_, index) => section(`Part ${index + 1}`, 15)),
    };
    const entries = readXlsxEntries(buildSectionWorkbook(template, report));
    const text = (name: string) => entries.find((entry) => entry.name === name)?.data.toString("utf8") ?? "";
    const charts = entries.filter((entry) => /^xl\/charts\/chart\d+\.xml$/.test(entry.name) && entry.data.toString("utf8").includes("<c:barChart>"));

    expect(charts).toHaveLength(5);
    // 15 bars: 6 + ceil(15 * 1.4) = 27 rows, so the second chart starts 27 rows below the first.
    const drawing = text("xl/drawings/drawing2.xml");
    const tops = [...drawing.matchAll(/<xdr:from><xdr:col>\d+<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/g)]
      .map((match) => Number(match[1]))
      .filter((row) => row >= 27);
    expect(tops.slice(0, 2)).toEqual([27, 54]);
    expect(text("xl/worksheets/sheet2.xml")).toContain("<rowBreaks count=");
  });

  it("writes a doughnut for a choice question and a bar chart for a grid, each on its own scale", () => {
    const report = {
      course,
      respondents: [{ timestamp: null, firstName: "a", lastName: "b", employeeCode: "1", companyCode: "ATA" }],
      companies: [{ companyCode: "ATA", count: 1 }],
      sections: [
        {
          name: "Part 1",
          questions: [
            { header: "scale of 4", kind: "RATING" as const, answers: [3], average: 3, outOf: 4 },
            {
              header: "which topic",
              kind: "CHOICE" as const,
              answers: ["Excel"],
              average: null,
              split: [{ label: "Excel", percent: 100 }, { label: "Power BI", percent: 0 }],
            },
            {
              header: "tick all that apply",
              kind: "GRID" as const,
              answers: ["row 1: yes"],
              average: null,
              gridSplit: { rows: ["row 1", "row 2"], columns: ["yes", "no"], percent: [[100, 0], [0, 100]] },
            },
          ],
        },
      ],
    };
    const entries = readXlsxEntries(buildSectionWorkbook(template, report));
    const generated = entries
      .filter((entry) => /^xl\/charts\/chart1\d\d\.xml$/.test(entry.name))
      .map((entry) => entry.data.toString("utf8"));

    expect(generated).toHaveLength(3);
    const bars = generated.filter((chart) => chart.includes("<c:barChart>"));
    expect(bars.find((chart) => chart.includes("Part 1 (เต็ม 4)"))).toContain('<c:max val="4"/>');

    // A choice question is slices, like the screen and like the template's own company doughnut.
    const choice = generated.find((chart) => chart.includes("<c:doughnutChart>"))!;
    expect(choice).toContain("which topic");
    expect(choice).toContain("<c:v>Excel</c:v>");
    expect(choice).not.toContain("<c:barChart>");

    // The grid chart reads rows as its categories and columns as its series.
    const grid = bars.find((chart) => chart.includes("tick all that apply (%)"))!;
    expect(grid).toContain("<c:v>yes</c:v>");
    expect(grid).toContain("<c:v>row 1</c:v>");
    expect(grid).toContain('<c:max val="100"/>');
    // A 0-100 axis stepped by 1 drew a hundred tick labels crushed under the bars.
    expect(grid).toContain('<c:majorUnit val="20"/>');
    // The grid's bars are its rows, so its category axis is shown rather than hidden.
    expect(/<c:catAx>[\s\S]*?<c:delete val="0"\/>/.test(grid)).toBe(true);
    // A rating chart keeps the template's hidden category axis and its step of 1.
    const rating = bars.find((chart) => chart.includes("Part 1 (เต็ม 4)"))!;
    expect(rating).toContain('<c:majorUnit val="1"/>');
    expect(/<c:catAx>[\s\S]*?<c:delete val="1"\/>/.test(rating)).toBe(true);
  });

  it("writes a company-layout workbook Excel can open: one chart per rating section, each with its own style part", () => {
    const analysis = analyseSheet(microsoftSheet);
    const report = buildSectionReport(
      analysis,
      [{ id: "a", name: "Part 2 : ความพึงพอใจ" }, { id: "b", name: "Part 3 : ความคิดเห็น" }],
      { 10: "a", 12: "b" },
      course,
    );
    const entries = readXlsxEntries(buildSectionWorkbook(template, report));
    const text = (name: string) => entries.find((entry) => entry.name === name)?.data.toString("utf8") ?? "";

    const charts = entries.filter((entry) => /^xl\/charts\/chart\d+\.xml$/.test(entry.name) && entry.data.toString("utf8").includes("<c:barChart>"));
    expect(charts).toHaveLength(1);
    const chartNumber = charts[0].name.match(/chart(\d+)/)![1];
    expect(text(`xl/charts/_rels/chart${chartNumber}.xml.rels`)).toContain(`style${chartNumber}.xml`);
    expect(text(charts[0].name)).toContain("Part 2 : ความพึงพอใจ");
    // The title keeps its run formatting whole; cutting it at the first "/>" broke the file.
    expect(text(charts[0].name)).toMatch(/<a:r><a:rPr\b[^>]*>[\s\S]*?<\/a:rPr><a:t>Part 2 : ความพึงพอใจ<\/a:t><\/a:r>/);

    // Replies are counted from any filled cell, not only the timestamp column.
    const responds = text("xl/worksheets/sheet2.xml").match(/<c r="AV13"[^>]*><f>([^<]*)<\/f><v>(\d+)<\/v>/)!;
    expect(responds[1]).toContain("$C$10:$C$5000");
    expect(responds[2]).toBe("3");

    expect(text("xl/workbook.xml")).toContain('fullCalcOnLoad="1"');
    expect(entries.some((entry) => entry.name === "xl/calcChain.xml")).toBe(false);

    // Rows 1-7 are the course header block, so the band row is the eighth row read.
    const [, , , , , , , bands, headers, firstReply] = readResponseSheet("report.xlsx", buildSectionWorkbook(template, report));
    expect(bands[6]).toBe("Part 2 : ความพึงพอใจ");
    expect(headers.slice(6, 8)).toEqual(["ความพึงพอใจโดยรวม", "ข้อเสนอแนะ"]);
    expect(firstReply.slice(2, 7)).toEqual(["สมชาย", "ทดสอบ", "0001", "ATA", "5"]);
  });

  it("keeps a section's comments off the report page when it opts out, as the company form does outside Part 4", () => {
    const written = (header: string, answer: string) => ({ header, kind: "TEXT" as const, answers: [answer], average: null });
    const report = {
      course,
      respondents: [{ timestamp: null, firstName: "a", lastName: "b", employeeCode: "1", companyCode: "ATA" }],
      companies: [{ companyCode: "ATA", count: 1 }],
      sections: [
        { name: "Part 3 : x", questions: [written("hidden question", "hidden answer")], showComments: false },
        { name: "Part 4 : y", questions: [written("shown question", "shown answer")], showComments: true },
      ],
    };
    const entries = readXlsxEntries(buildSectionWorkbook(template, report));
    const text = (name: string) => entries.find((entry) => entry.name === name)?.data.toString("utf8") ?? "";
    const reportPage = text("xl/worksheets/sheet2.xml");
    expect(reportPage).toContain("shown answer");
    expect(reportPage).not.toContain("hidden answer");
    // Every written answer still reaches the full comment sheet.
    expect(text("xl/worksheets/sheet3.xml")).toContain("hidden answer");
  });
});

describe("worksheet cell helper", () => {
  it("inserts a new cell in column order, not after the row's last cell", () => {
    const sheet = '<sheetData><row r="4"><c r="AT4" s="1"/></row></sheetData>';
    expect(setCell(sheet, "A4", "x")).toBe('<sheetData><row r="4"><c r="A4" t="inlineStr"><is><t xml:space="preserve">x</t></is></c><c r="AT4" s="1"/></row></sheetData>');
  });
});
