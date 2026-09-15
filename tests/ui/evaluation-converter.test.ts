import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyseSheet, convertSheet } from "../../app/lib/externalEvaluation/convert";
import { parseCsv, readResponseSheet } from "../../app/lib/externalEvaluation/readSheet";
import { buildEvaluationSummaryWorkbook } from "../../app/lib/evaluationSummaryWorkbook";
import { readXlsxEntries, setCell } from "../../app/lib/xlsxTemplate";
import { assignFromStandard, buildSectionReport } from "../../app/lib/externalEvaluation/sections";
import { buildSectionWorkbook, readStandardSections } from "../../app/lib/externalEvaluation/sectionWorkbook";
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

  it("summarises like an in-system evaluation", () => {
    const { summary, responses } = convertSheet(analysis, course, "Test");
    expect(summary.isAnonymous).toBe(false);
    expect(summary.submittedCount).toBe(3);
    expect(summary.respondentsByCompany).toEqual([
      { companyCode: "ATA", companyName: "ATA", count: 2, percent: 66.7 },
      { companyCode: "TEP", companyName: "TEP", count: 1, percent: 33.3 },
    ]);
    const [rating, topics, comments] = summary.questions;
    expect(rating.averageRating).toBe(4.33);
    expect(rating.ratingDistribution.find((bucket) => bucket.value === 4)?.count).toBe(2);
    expect(topics.options.map((option) => [option.optionText, option.count])).toEqual([["Excel", 2], ["Power BI", 2]]);
    expect(comments.textAnswers).toHaveLength(3);
    // Excel serials, read as Bangkok local time: 46241.5 is noon on 2026-08-07.
    expect(responses.responses[0].startedAt).toBe("2026-08-07T05:00:00.000Z");
    expect(summary.averageAnswerSeconds).toBe(216);
    expect(responses.responses[0].respondentName).toBe("สมชาย ทดสอบ");
    expect(responses.responses[0].employeeCode).toBe("0001");
  });

  it("follows a column HRD switches to another type", () => {
    const edited = {
      ...analysis,
      columns: analysis.columns.map((column) => (column.header === "ข้อเสนอแนะ" ? { ...column, role: "SKIP" as const } : column)),
    };
    expect(convertSheet(edited, course, "Test").summary.questions).toHaveLength(2);
  });
});

describe("Google Forms export", () => {
  const analysis = analyseSheet(parseCsv(googleCsv));

  it("recognises the service, and treats a sheet with no name or code as anonymous", () => {
    expect(analysis.source).toBe("GOOGLE");
    const { summary, responses } = convertSheet(analysis, course, "Test");
    expect(summary.isAnonymous).toBe(true);
    expect(responses.responses.every((response) => response.respondentName === null)).toBe(true);
    expect(summary.questions.map((question) => question.questionType)).toEqual(["RATING", "SINGLE_CHOICE", "LONG_TEXT"]);
  });
});

describe("the chart workbook", () => {
  it("builds from a converted file with no course dates, and reads back through the same reader", () => {
    const { summary, responses } = convertSheet(analyseSheet(microsoftSheet), course, "Test");
    const workbook = buildEvaluationSummaryWorkbook(readFileSync("app/Excel/Evaluation_Form_Tem.xlsx"), summary, responses);
    const [header] = readResponseSheet("report.xlsx", workbook);
    expect(header.slice(-3)).toEqual(["ความพึงพอใจโดยรวม", "หัวข้อที่สนใจ", "ข้อเสนอแนะ"]);
  });

  it("scales every bar chart to 0-100, since the bars are percentages", () => {
    const { summary, responses } = convertSheet(analyseSheet(microsoftSheet), course, "Test");
    const workbook = buildEvaluationSummaryWorkbook(readFileSync("app/Excel/Evaluation_Form_Tem.xlsx"), summary, responses);
    const bars = readXlsxEntries(workbook)
      .map((entry) => entry.data.toString("utf8"))
      .filter((xml) => xml.includes("<c:barChart>"));
    expect(bars.length).toBeGreaterThan(0);
    for (const xml of bars) {
      expect(xml).not.toContain('<c:max val="5"/>');
      expect(xml).toContain('<c:max val="100"/>');
    }
  });
});

describe("Advanced mode: sections", () => {
  const template = readFileSync("app/Excel/1. Evaluation Form.xlsx");
  const standard = readStandardSections(template);

  it("reads the company template's sections from its row-8 bands", () => {
    expect(standard.map((section) => section.headers.length)).toEqual([6, 3, 3, 5, 2]);
  });

  it("groups by header text, and by position when the template headers are placeholders", () => {
    const analysis = analyseSheet(microsoftSheet);
    const named = assignFromStandard(analysis, [
      { name: "Ratings", headers: ["ความพึงพอใจโดยรวม"] },
      { name: "Written", headers: ["ข้อเสนอแนะ "] },
    ]);
    expect(named.matched).toBe(2);
    expect(named.sections.map((section) => section.name)).toEqual(["Ratings", "Written"]);

    const byPosition = assignFromStandard(analysis, [
      { name: "A", headers: ["Column1", "Column2"] },
      { name: "B", headers: ["Column3"] },
    ]);
    expect(byPosition.matched).toBe(3);
    expect(Object.values(byPosition.assignment)).toEqual(["std-0", "std-0", "std-1"]);
  });

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

    expect(text("xl/workbook.xml")).toContain('fullCalcOnLoad="1"');
    expect(entries.some((entry) => entry.name === "xl/calcChain.xml")).toBe(false);

    // Rows 1-7 are the course header block, so the band row is the eighth row read.
    const [, , , , , , , bands, headers, firstReply] = readResponseSheet("report.xlsx", buildSectionWorkbook(template, report));
    expect(bands[6]).toBe("Part 2 : ความพึงพอใจ");
    expect(headers.slice(6, 8)).toEqual(["ความพึงพอใจโดยรวม", "ข้อเสนอแนะ"]);
    expect(firstReply.slice(2, 7)).toEqual(["สมชาย", "ทดสอบ", "0001", "ATA", "5"]);
  });
});

describe("worksheet cell helper", () => {
  it("inserts a new cell in column order, not after the row's last cell", () => {
    const sheet = '<sheetData><row r="4"><c r="AT4" s="1"/></row></sheetData>';
    expect(setCell(sheet, "A4", "x")).toBe('<sheetData><row r="4"><c r="A4" t="inlineStr"><is><t xml:space="preserve">x</t></is></c><c r="AT4" s="1"/></row></sheetData>');
  });
});
