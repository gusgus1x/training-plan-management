import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvaluationSummaryWorkbook } from "../../app/lib/evaluationSummaryWorkbook";
import { readXlsxEntries } from "../../app/lib/xlsxTemplate";
import type { EvaluationResponseList, EvaluationSummary } from "../../app/lib/trainingForms/types";

/**
 * The template is a skeleton: its charts point at `#REF!` and it has no response columns at all.
 * Everything worth testing is therefore generated - the columns the form decided on, one chart per
 * question pointing at a range that exists, and the written answers on the two sheets that carry
 * them. A chart left on `#REF!` would open as an empty frame and look like a broken export.
 */

const TEMPLATE = readFileSync("app/Excel/Evaluation_Form_Tem.xlsx");

const part = (workbook: Buffer, name: string) =>
  readXlsxEntries(workbook).find((entry) => entry.name === name)?.data.toString("utf8") ?? null;

const names = (workbook: Buffer) => readXlsxEntries(workbook).map((entry) => entry.name);

const cells = (workbook: Buffer, sheet: string) => {
  const xml = part(workbook, sheet)!;
  const found = new Map<string, string>();
  // An empty cell is written self-closing, so the pattern has to stop at `/>` as well as at `</c>`.
  for (const match of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(\/>|>([\s\S]*?)<\/c>)/g)) {
    const body = match[3] ?? "";
    const value =
      /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ??
      [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
    found.set(match[1], value);
  }
  return found;
};

const question = (
  overrides: Partial<EvaluationSummary["questions"][number]> & { questionId: string; questionOrder: number },
): EvaluationSummary["questions"][number] => ({
  questionText: "คำถาม",
  questionType: "RATING",
  sectionName: null,
  answeredBy: 2,
  averageRating: null,
  ratingDistribution: [],
  options: [],
  gridRows: [],
  textAnswers: [],
  textAnswersWithheld: false,
  ...overrides,
});

const summary = (): EvaluationSummary => ({
  evaluationFormId: "900",
  formName: "แบบประเมิน",
  description: null,
  isAnonymous: false,
  timing: "EVALUATION",
  respondentGroup: "EMPLOYEE",
  expectedCount: 28,
  submittedCount: 2,
  responseRatePercent: 7,
  averageAnswerSeconds: 420,
  course: {
    planCode: "OAP-2026-OT-000002-B02",
    courseName: "Way of working",
    batchName: "4",
    startAt: "2026-08-11T02:00:00.000Z",
    endAt: "2026-08-11T09:00:00.000Z",
    venue: "ห้องอบรม A",
    instructor: "วิทยากรทดสอบ",
    organiser: "CENTER",
  },
  respondentsByCompany: [
    { companyCode: "ATA", companyName: "เอทีเอ", count: 1, percent: 50 },
    { companyCode: "TEP", companyName: "ทีอีพี", count: 1, percent: 50 },
  ],
  questions: [
    question({ questionId: "s1", questionOrder: 1, questionText: "ส่วนที่ 1", questionType: "SECTION_BREAK" }),
    question({
      questionId: "1",
      questionOrder: 2,
      questionText: "ความรู้ก่อนอบรม",
      averageRating: 3.5,
      ratingDistribution: [
        { value: 3, count: 1 },
        { value: 4, count: 1 },
      ],
    }),
    question({
      questionId: "2",
      questionOrder: 3,
      questionText: "ท่านทราบข่าวจากที่ใด",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { optionId: "o1", optionText: "หัวหน้า", count: 2, percent: 100 },
        { optionId: "o2", optionText: "อีเมล", count: 1, percent: 50 },
      ],
    }),
    question({
      questionId: "3",
      questionOrder: 4,
      questionText: "ประเมินวิทยากร",
      questionType: "MULTIPLE_CHOICE_GRID",
      gridRows: [
        {
          rowId: "r1",
          rowText: "ความชัดเจน",
          answeredBy: 2,
          cells: [
            { columnId: "c1", columnText: "ดี", count: 1, percent: 50 },
            { columnId: "c2", columnText: "พอใช้", count: 1, percent: 50 },
          ],
        },
      ],
    }),
    question({ questionId: "4", questionOrder: 5, questionText: "ข้อเสนอแนะ", questionType: "LONG_TEXT" }),
    question({ questionId: "5", questionOrder: 6, questionText: "หัวข้อครั้งต่อไป", questionType: "SHORT_TEXT" }),
  ],
});

const responses = (): EvaluationResponseList => ({
  formName: "แบบประเมิน",
  isAnonymous: false,
  timing: "EVALUATION",
  respondentGroup: "EMPLOYEE",
  questions: [],
  responses: [
    {
      responseNo: 1,
      respondentName: "นางสาว สมหญิง ใจดี",
      respondentPosition: null,
      companyCode: "ATA",
      employeeCode: "E-001",
      subjectName: null,
      startedAt: "2026-08-12T03:40:00.000Z",
      submittedAt: "2026-08-12T04:00:00.000Z",
      answers: [
        { questionId: "1", choices: [], ratingValue: 4, text: null },
        { questionId: "2", choices: ["หัวหน้า", "อีเมล"], ratingValue: null, text: null },
        { questionId: "3", choices: ["ความชัดเจน: ดี"], ratingValue: null, text: null },
        { questionId: "4", choices: [], ratingValue: null, text: "เวลาน้อยไป" },
      ],
    },
    {
      responseNo: 2,
      respondentName: "นาย สมชาย รักงาน",
      respondentPosition: null,
      companyCode: "TEP",
      employeeCode: null,
      subjectName: null,
      startedAt: null,
      submittedAt: null,
      answers: [
        { questionId: "1", choices: [], ratingValue: 3, text: null },
        { questionId: "3", choices: ["ความชัดเจน: พอใช้"], ratingValue: null, text: null },
      ],
    },
  ],
});

describe("buildEvaluationSummaryWorkbook", () => {
  it("gives every question a column, and a grid one column per row", () => {
    const data = cells(buildEvaluationSummaryWorkbook(TEMPLATE, summary(), responses()), "xl/worksheets/sheet1.xml");

    expect(data.get("A1")).toBe("ID");
    expect(data.get("G1")).toBe("Company");
    expect(data.get("H1")).toBe("ความรู้ก่อนอบรม");
    expect(data.get("I1")).toBe("ท่านทราบข่าวจากที่ใด");
    // Google's shape, not Microsoft's: the row in brackets, the question written once.
    expect(data.get("J1")).toBe("ประเมินวิทยากร [ความชัดเจน]");
    expect(data.get("K1")).toBe("ข้อเสนอแนะ");

    // Day, month, year, then the clock to the second - the two columns the average answering time
    // is worked out from.
    expect(data.get("B2")).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    expect(data.get("C2")).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    expect(data.get("D2")).toBe("E-001");
    expect(data.get("E2")).toBe("นางสาว สมหญิง");
    expect(data.get("F2")).toBe("ใจดี");
    expect(data.get("G2")).toBe("ATA");
    // A rating is a number; a multi-choice is every tick in one cell; a grid cell drops the row
    // name it was stored under.
    expect(data.get("H2")).toBe("4");
    expect(data.get("I2")).toBe("หัวหน้า, อีเมล");
    expect(data.get("J2")).toBe("ดี");
    expect(data.get("K2")).toBe("เวลาน้อยไป");
    // Nobody has an employee code on an imported row, so the reply's number stands in.
    expect(data.get("D3")).toBe("2");
  });

  it("builds one chart per question, each pointing at a range that exists", () => {
    const book = buildEvaluationSummaryWorkbook(TEMPLATE, summary(), responses());

    // The doughnut plus one per answerable question. The written question gets none.
    expect(names(book).filter((name) => name.startsWith("xl/charts/"))).toEqual([
      "xl/charts/chart1.xml",
      "xl/charts/chart2.xml",
      "xl/charts/chart3.xml",
      "xl/charts/chart4.xml",
    ]);

    for (const name of names(book).filter((entry) => entry.startsWith("xl/charts/"))) {
      expect(part(book, name)!).not.toContain("#REF!");
      expect(part(book, name)!).toContain("ChartData!");
    }

    // The rating chart keeps all five values, so a score nobody gave still reads as zero.
    const rating = part(book, "xl/charts/chart2.xml")!;
    expect(rating).toContain("<a:t>ความรู้ก่อนอบรม</a:t>");
    expect(rating).toContain('<c:ptCount val="5"/>');

    const chartData = cells(book, "xl/worksheets/sheet4.xml");
    expect(chartData.get("A1")).toBe("Company");
    expect(chartData.get("A2")).toBe("ATA");
    expect(chartData.get("B2")).toBe("1");
    // The sheet is declared to the workbook, or the charts read nothing.
    expect(part(book, "xl/workbook.xml")!).toContain('name="ChartData" sheetId="99"');
    expect(part(book, "[Content_Types].xml")!).toContain("/xl/worksheets/sheet4.xml");
  });

  it("writes the dashboard header, the two counts and a preview of the written answers", () => {
    const dashboard = cells(
      buildEvaluationSummaryWorkbook(TEMPLATE, summary(), responses()),
      "xl/worksheets/sheet2.xml",
    );

    expect(dashboard.get("C2")).toBe("Way of working");
    expect(dashboard.get("H7")).toBe("ห้องอบรม A");
    expect(dashboard.get("H8")).toBe("วิทยากรทดสอบ");
    expect(dashboard.get("B6")).toBe("2");
    // Two people from two companies.
    expect(dashboard.get("C6")).toBe("2");
    expect(dashboard.get("G20")).toBe("ข้อเสนอแนะ");
    expect(dashboard.get("G21")).toBe("• เวลาน้อยไป");
  });

  it("puts every written answer on the Comments sheet, and skips people who wrote nothing", () => {
    const comments = cells(
      buildEvaluationSummaryWorkbook(TEMPLATE, summary(), responses()),
      "xl/worksheets/sheet3.xml",
    );

    expect(comments.get("A3")).toBe("ลำดับ");
    expect(comments.get("B3")).toBe("ข้อเสนอแนะ");
    expect(comments.get("C3")).toBe("หัวข้อครั้งต่อไป");
    expect(comments.get("A4")).toBe("1");
    expect(comments.get("B4")).toBe("เวลาน้อยไป");
    // The second person left every box empty, so they get no row.
    expect(comments.has("B5")).toBe(false);
  });

  it("gives the second question column the same yellow heading as the first", () => {
    // The template styles one question column and leaves the rest bare, which on a form with four
    // written questions reads as three columns somebody forgot.
    const xml = part(buildEvaluationSummaryWorkbook(TEMPLATE, summary(), responses()), "xl/worksheets/sheet3.xml")!;
    const styleOf = (reference: string) =>
      new RegExp(`<c r="${reference}"[^>]*\\bs="(\\d+)"`).exec(xml)?.[1];

    expect(styleOf("C3")).toBe(styleOf("B3"));
    expect(styleOf("C4")).toBe(styleOf("B4"));
  });

  it("previews at most five answers per question, however many people wrote one", () => {
    const many = responses();
    many.responses = Array.from({ length: 12 }, (_, index) => ({
      ...many.responses[0],
      responseNo: index + 1,
      answers: [{ questionId: "4", choices: [], ratingValue: null, text: `ความเห็น ${index + 1}` }],
    }));

    const dashboard = cells(buildEvaluationSummaryWorkbook(TEMPLATE, summary(), many), "xl/worksheets/sheet2.xml");

    expect(dashboard.get("G20")).toBe("ข้อเสนอแนะ");
    expect(dashboard.get("G25")).toBe("• ความเห็น 5");
    // The sixth answer is not previewed; the Comments sheet is where they all live.
    expect(dashboard.get("G26") ?? "").not.toContain("ความเห็น 6");
  });

  it("keeps an anonymous reply anonymous, down to the minute it was submitted", () => {
    const anonymous = summary();
    anonymous.isAnonymous = true;
    const list = responses();
    list.isAnonymous = true;
    // What the repository hands over for an anonymous form: no name, no employee code, but the
    // company, which it looks up on a query that reads nothing else.
    list.responses = list.responses.map((person) => ({
      ...person,
      respondentName: null,
      companyCode: "ATA",
      employeeCode: null,
    }));

    const data = cells(buildEvaluationSummaryWorkbook(TEMPLATE, anonymous, list), "xl/worksheets/sheet1.xml");

    // Every column that would have named somebody says so, rather than leaving blanks that read as
    // missing data.
    expect(data.get("D2")).toBe("anonymous");
    expect(data.get("E2")).toBe("anonymous");
    expect(data.get("F2")).toBe("anonymous");
    // The company is the exception, at HRD's request: the report splits the replies by it.
    expect(data.get("G2")).toBe("ATA");
    // The times are written in full even here, at HRD's request: they are what the average
    // answering time is worked out from.
    expect(data.get("C2")).toMatch(/\d{2}:\d{2}:\d{2}$/);
  });
});
