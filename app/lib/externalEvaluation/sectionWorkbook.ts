import {
  cellXml,
  columnLetter,
  escapeXlsxXml,
  readXlsxEntries,
  replaceRowsFrom,
  setCell,
  writeXlsxEntries,
  type XlsxEntry,
} from "../xlsxTemplate";
import type { SectionReport } from "./sections";

/**
 * Advanced mode's report, written into the company's own evaluation workbook
 * (`app/Excel/1. Evaluation Form.xlsx`):
 *
 * - `01-Database` - course header in row 3, a section band in row 8, question headers in row 9, one
 *   reply per row from row 10. Laid out exactly as HRD have always pasted their Forms export.
 * - `02-รายงานผลการจัดอบรม` - the printed dashboard: reply and company counts, the company doughnut,
 *   one bar chart per section (average score per question, 0-5), written answers down the right.
 * - `02-Comment` - every written answer, question across.
 *
 * The template used to compute all of this with pivot tables, which only refresh inside desktop
 * Excel. Here the numbers are ordinary formulas over `01-Database`, with their values also written
 * into the file: correct on open anywhere, and still recalculating if HRD edits a reply in Excel.
 */

const DATABASE = "xl/worksheets/sheet1.xml";
const REPORT = "xl/worksheets/sheet2.xml";
const COMMENT = "xl/worksheets/sheet3.xml";
const WORKBOOK = "xl/workbook.xml";
const WORKBOOK_RELS = "xl/_rels/workbook.xml.rels";
const CONTENT_TYPES = "[Content_Types].xml";
const DRAWING = "xl/drawings/drawing2.xml";
const DRAWING_RELS = "xl/drawings/_rels/drawing2.xml.rels";
/** The first section chart the template drew: the shape every section chart is cut from. */
const BAR_TEMPLATE = "xl/charts/chart1.xml";
const BAR_TEMPLATE_RELS = "xl/charts/_rels/chart1.xml.rels";
/** Every bar chart part the template carries; all are replaced by generated ones. */
const TEMPLATE_BAR_CHARTS = [1, 2, 3];
const DOUGHNUT = "xl/charts/chart4.xml";
/** Relationship ids of the three template bar charts in the dashboard drawing. */
const TEMPLATE_BAR_RELATIONSHIPS = ["rId5", "rId7", "rId8"];
const BAR_ANCHOR_RELATIONSHIP = "rId5";

const DATABASE_SHEET = "'01-Database'";
const REPORT_SHEET = "'02-รายงานผลการจัดอบรม'";

// 01-Database
const IDENTITY_LAST_COLUMN = 6; // B:F - Timestamp, First Name, Last Name, Employee ID, Company
const FIRST_QUESTION_COLUMN = 7; // G
const BAND_ROW = 8;
const HEADER_ROW = 9;
const FIRST_DATA_ROW = 10;
/** Formulas reach this far down so a reply typed in later still counts. */
const LAST_FORMULA_ROW = 5000;
const STYLE = {
  bandRating: "201",
  bandRatingRest: "202",
  bandText: "198",
  headerRating: "116",
  headerText: "117",
  dataRating: "33",
  dataText: "38",
  dataTimestamp: "169",
  dataIdentity: "26",
};

// 02-รายงานผลการจัดอบรม
const COMPANY_FIRST_ROW = 3;
const CHART_FIRST_ROW = 27;
const CHART_ROWS = 16;
const COMMENT_FIRST_ROW = 28;
const COMMENT_ANSWERS_PER_QUESTION = 5;
const COMMENT_PREVIEW_LENGTH = 90;
const COMMENT_STYLE = { section: "98", question: "167", answer: "208" };
const PRINT_LAST_ROW = 77;

const RATING_COLOURS = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"];

const formulaCell = (reference: string, style: string | undefined, formula: string, cached: string | number) => {
  const attrs = `r="${reference}"${style ? ` s="${style}"` : ""}`;
  return typeof cached === "number"
    ? `<c ${attrs}><f>${escapeXlsxXml(formula)}</f><v>${cached}</v></c>`
    : `<c ${attrs} t="str"><f>${escapeXlsxXml(formula)}</f><v>${escapeXlsxXml(cached)}</v></c>`;
};

/** Replaces a formula cell in place, keeping its style; creates it when the template has none. */
const setFormula = (worksheet: string, reference: string, formula: string, cached: string | number) => {
  const withCell = setCell(worksheet, reference, "x");
  const current = new RegExp(`<c\\b[^>]*?\\br="${reference}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`).exec(withCell)!;
  const style = current[0].match(/\bs="([^"]+)"/)?.[1];
  return withCell.replace(current[0], formulaCell(reference, style, formula, cached));
};

/** Writes a cell with exactly this style. `setCell` keeps whatever style the template had there, and
 *  the dashboard's right-hand column carries a different leftover style on almost every row. */
const setStyledCell = (worksheet: string, reference: string, value: string | number | null, style: string) => {
  const withCell = setCell(worksheet, reference, "x");
  const current = new RegExp(`<c\\b[^>]*?\\br="${reference}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`).exec(withCell)!;
  return withCell.replace(current[0], cellXml(reference, style, value));
};

/** Sets a row's height, replacing whatever the template gave that row. */
const setRowHeight = (worksheet: string, row: number, height: number) =>
  worksheet.replace(new RegExp(`<row\\b([^>]*?)\\br="${row}"([^>]*?)(\\/?)>`), (_, before: string, after: string, close: string) => {
    const attributes = `${before} r="${row}" ${after}`.replace(/\s*ht="[^"]*"/, "").replace(/\s*customHeight="[^"]*"/, "").replace(/\s+/g, " ");
    return `<row ${attributes.trim()} ht="${height}" customHeight="1"${close}>`;
  });

const rowXml = (row: number, cells: string[], attributes = "") => `<row r="${row}"${attributes}>${cells.join("")}</row>`;

const thaiDateRange = (startAt: string, endAt: string) => {
  if (!startAt) return "-";
  const format = (iso: string) =>
    new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(iso));
  const start = format(startAt);
  const end = format(endAt || startAt);
  return start === end ? start : `${start} - ${end}`;
};

export const buildSectionWorkbook = (template: Buffer, report: SectionReport): Buffer => {
  const entries = readXlsxEntries(template);
  const find = (name: string) => {
    const entry = entries.find((item) => item.name === name);
    if (!entry) throw new Error(`Invalid Excel template: ${name} was not found.`);
    return entry;
  };
  const read = (name: string) => find(name).data.toString("utf8");
  const edit = (name: string, change: (xml: string) => string) => {
    const entry = find(name);
    entry.data = Buffer.from(change(entry.data.toString("utf8")), "utf8");
  };
  const add = (name: string, data: string, like: XlsxEntry) => entries.push({ ...like, name, data: Buffer.from(data, "utf8") });
  const remove = (name: string) => {
    const index = entries.findIndex((entry) => entry.name === name);
    if (index !== -1) entries.splice(index, 1);
  };

  const questions = report.sections.flatMap((section) => section.questions.map((question) => ({ section, question })));
  const columnOf = new Map(questions.map((entry, index) => [entry.question, FIRST_QUESTION_COLUMN + index]));
  const lastColumn = Math.max(IDENTITY_LAST_COLUMN, FIRST_QUESTION_COLUMN + questions.length - 1);
  const lastDataRow = FIRST_DATA_ROW + report.respondents.length - 1;
  const rangeOf = (column: number) =>
    `${DATABASE_SHEET}!$${columnLetter(column)}$${FIRST_DATA_ROW}:$${columnLetter(column)}$${LAST_FORMULA_ROW}`;

  // --- 01-Database -------------------------------------------------------------------------------
  edit(DATABASE, (xml) => {
    let sheet = xml;
    sheet = setCell(sheet, "D3", report.course.courseName || "-");
    sheet = setCell(sheet, "F3", thaiDateRange(report.course.startAt, report.course.endAt));
    sheet = setCell(sheet, "I3", report.course.venue ?? "-");
    sheet = setCell(sheet, "Q3", report.course.instructor ?? "-");

    const templateRow = (row: number) => new RegExp(`<row\\b[^>]*?\\br="${row}"[^>]*?>([\\s\\S]*?)<\\/row>`).exec(sheet);
    const identityCells = (row: number) =>
      [...(templateRow(row)?.[1] ?? "").matchAll(/<c\b[^>]*?\br="([A-F])\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map((match) => match[0]);
    const rowAttributes = (row: number) => {
      const tag = new RegExp(`<row\\b([^>]*?)\\br="${row}"([^>]*)>`).exec(sheet);
      return tag ? `${tag[1]}${tag[2]}`.replace(/\s*spans="[^"]*"/, "").replace(/\s+/g, " ").trimEnd() : "";
    };
    const bandAttributes = rowAttributes(BAND_ROW);
    const headerAttributes = rowAttributes(HEADER_ROW);
    const bandIdentity = identityCells(BAND_ROW);
    const headerIdentity = identityCells(HEADER_ROW);

    const band: string[] = [...bandIdentity];
    const header: string[] = [...headerIdentity];
    for (const section of report.sections) {
      section.questions.forEach((question, index) => {
        const column = columnLetter(columnOf.get(question)!);
        const isRating = question.kind === "RATING";
        band.push(
          cellXml(
            `${column}${BAND_ROW}`,
            isRating ? (index === 0 ? STYLE.bandRating : STYLE.bandRatingRest) : STYLE.bandText,
            index === 0 ? section.name : null,
          ),
        );
        header.push(cellXml(`${column}${HEADER_ROW}`, isRating ? STYLE.headerRating : STYLE.headerText, question.header));
      });
    }

    const data = report.respondents.map((respondent, rowIndex) => {
      const row = FIRST_DATA_ROW + rowIndex;
      return rowXml(row, [
        cellXml(`B${row}`, STYLE.dataTimestamp, respondent.timestamp),
        cellXml(`C${row}`, STYLE.dataIdentity, respondent.firstName || null),
        cellXml(`D${row}`, STYLE.dataIdentity, respondent.lastName || null),
        cellXml(`E${row}`, STYLE.dataIdentity, respondent.employeeCode || null),
        cellXml(`F${row}`, STYLE.dataIdentity, respondent.companyCode || null),
        ...questions.map(({ question }) =>
          cellXml(
            `${columnLetter(columnOf.get(question)!)}${row}`,
            question.kind === "RATING" ? STYLE.dataRating : STYLE.dataText,
            question.answers[rowIndex],
          ),
        ),
      ]);
    });

    sheet = replaceRowsFrom(
      sheet,
      BAND_ROW,
      rowXml(BAND_ROW, band, bandAttributes ? ` ${bandAttributes}` : "") +
        rowXml(HEADER_ROW, header, headerAttributes ? ` ${headerAttributes}` : "") +
        data.join(""),
    );
    // Row 7 carried the "Step 4 - test scores" note over a band that no longer exists.
    sheet = sheet.replace(/<c r="Z7"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/, "");

    const widths = questions
      .map(({ question }, index) => {
        const column = FIRST_QUESTION_COLUMN + index;
        const width = question.kind === "RATING" ? "11.3984375" : "19";
        return `<col min="${column}" max="${column}" width="${width}" style="43" customWidth="1"/>`;
      })
      .join("");
    sheet = sheet.replace(/<cols>([\s\S]*?)<\/cols>/, (_, inner: string) => {
      const identity = [...inner.matchAll(/<col [^>]*\/>/g)].map((match) => match[0]).filter((col) => Number(col.match(/min="(\d+)"/)?.[1]) <= IDENTITY_LAST_COLUMN);
      return `<cols>${identity.join("")}${widths}<col min="${lastColumn + 1}" max="16384" width="8.8984375" style="21"/></cols>`;
    });

    const bandMerges = report.sections
      .map((section) => {
        const first = columnOf.get(section.questions[0])!;
        const last = columnOf.get(section.questions[section.questions.length - 1])!;
        return first === last ? "" : `<mergeCell ref="${columnLetter(first)}${BAND_ROW}:${columnLetter(last)}${BAND_ROW}"/>`;
      })
      .filter(Boolean);
    sheet = sheet.replace(/<mergeCells count="\d+">([\s\S]*?)<\/mergeCells>/, (_, inner: string) => {
      const kept = [...inner.matchAll(/<mergeCell ref="([A-Z]+)(\d+):[A-Z]+\d+"\/>/g)]
        .filter((match) => Number(match[2]) !== BAND_ROW || match[1] === "B")
        .map((match) => match[0]);
      const all = [...kept, ...bandMerges];
      return `<mergeCells count="${all.length}">${all.join("")}</mergeCells>`;
    });
    return sheet.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="B1:${columnLetter(lastColumn)}${Math.max(lastDataRow, HEADER_ROW)}"/>`);
  });

  // --- 02-รายงานผลการจัดอบรม: calculation block, counts, header ---------------------------------
  const companyLastRow = COMPANY_FIRST_ROW + Math.max(report.companies.length, 1) - 1;
  type ChartRow = { row: number; question: (typeof questions)[number]["question"] };
  const sectionRows: Array<{ name: string; rows: ChartRow[] }> = [];
  edit(REPORT, (xml) => {
    let sheet = xml;
    sheet = setCell(sheet, "A2", "Company");
    sheet = setCell(sheet, "B2", "Responds");
    report.companies.forEach((company, index) => {
      const row = COMPANY_FIRST_ROW + index;
      sheet = setCell(sheet, `A${row}`, company.companyCode);
      sheet = setFormula(sheet, `B${row}`, `COUNTIF(${DATABASE_SHEET}!$F$${FIRST_DATA_ROW}:$F$${LAST_FORMULA_ROW},A${row})`, company.count);
    });

    let row = companyLastRow + 2;
    for (const section of report.sections) {
      const ratings = section.questions.filter((question) => question.kind === "RATING");
      if (!ratings.length) continue;
      sheet = setCell(sheet, `A${row}`, section.name);
      row += 1;
      const rows: ChartRow[] = [];
      for (const question of ratings) {
        sheet = setCell(sheet, `A${row}`, question.header);
        sheet = setFormula(sheet, `B${row}`, `IFERROR(ROUND(AVERAGE(${rangeOf(columnOf.get(question)!)}),2),0)`, question.average ?? 0);
        rows.push({ row, question });
        row += 1;
      }
      sectionRows.push({ name: section.name, rows });
      row += 1;
    }

    // A reply is a row with anything in it. Counting the timestamp column alone gave 0 for a file
    // with no time column.
    const filled = Array.from({ length: lastColumn - 1 }, (_, offset) => `(${rangeOf(2 + offset)}<>"")`).join("+");
    sheet = setFormula(sheet, "AV13", `SUMPRODUCT(--((${filled})>0))`, report.respondents.length);
    sheet = setFormula(sheet, "AZ13", `COUNTIF($B$${COMPANY_FIRST_ROW}:$B$${companyLastRow},">0")`, report.companies.length);
    const headerText = {
      BB3: [`${DATABASE_SHEET}!D3`, report.course.courseName || "-"],
      BM14: [`${DATABASE_SHEET}!D3`, report.course.courseName || "-"],
      BM16: [`${DATABASE_SHEET}!F3`, thaiDateRange(report.course.startAt, report.course.endAt)],
      BM18: [`${DATABASE_SHEET}!I3`, report.course.venue ?? "-"],
      BM20: [`${DATABASE_SHEET}!Q3`, report.course.instructor ?? "-"],
    } as const;
    for (const [reference, [formula, cached]] of Object.entries(headerText)) {
      sheet = setFormula(sheet, reference, formula, cached);
    }

    // Written answers down the right-hand column, a few per question; the full set is on 02-Comment.
    let commentRow = COMMENT_FIRST_ROW;
    const answerMerges: string[] = [];
    for (const section of report.sections) {
      const texts = section.questions.filter((question) => question.kind === "TEXT");
      if (!texts.length) continue;
      sheet = setRowHeight(setStyledCell(sheet, `BJ${commentRow}`, section.name, COMMENT_STYLE.section), commentRow, 30);
      commentRow += 1;
      for (const question of texts) {
        sheet = setRowHeight(setStyledCell(sheet, `BJ${commentRow}`, question.header, COMMENT_STYLE.question), commentRow, 24);
        answerMerges.push(`<mergeCell ref="BJ${commentRow}:BP${commentRow}"/>`);
        commentRow += 1;
        const answers = question.answers.filter((answer): answer is string => typeof answer === "string").slice(0, COMMENT_ANSWERS_PER_QUESTION);
        for (const answer of answers) {
          // One line each - a preview; every answer in full is on 02-Comment.
          const preview = answer.length > COMMENT_PREVIEW_LENGTH ? `${answer.slice(0, COMMENT_PREVIEW_LENGTH)}…` : answer;
          sheet = setRowHeight(setStyledCell(sheet, `BJ${commentRow}`, `• ${preview}`, COMMENT_STYLE.answer), commentRow, 18);
          answerMerges.push(`<mergeCell ref="BJ${commentRow}:BP${commentRow}"/>`);
          commentRow += 1;
        }
      }
    }
    sheet = sheet.replace(/<mergeCells count="\d+">([\s\S]*?)<\/mergeCells>/, (_, inner: string) => {
      const kept = [...inner.matchAll(/<mergeCell ref="([A-Z]+)(\d+):[A-Z]+\d+"\/>/g)]
        .filter((match) => !(match[1] === "BJ" && Number(match[2]) >= COMMENT_FIRST_ROW))
        .map((match) => match[0]);
      const all = [...kept, ...answerMerges];
      return `<mergeCells count="${all.length}">${all.join("")}</mergeCells>`;
    });

    const lastChartRow = CHART_FIRST_ROW + sectionRows.length * CHART_ROWS;
    const printLast = Math.max(PRINT_LAST_ROW, lastChartRow + 1, commentRow);
    edit(WORKBOOK, (workbook) =>
      workbook
        .replace(/('02-รายงานผลการจัดอบรม'!\$AT\$3:\$BP\$)\d+/, `$1${printLast}`)
        .replace(/<calcPr([^>]*?)\/>/, (match, attributes: string) => (/fullCalcOnLoad/.test(attributes) ? match : `<calcPr${attributes} fullCalcOnLoad="1"/>`)),
    );
    return sheet.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="A1:BR${Math.max(80, printLast, row)}"/>`);
  });

  // --- 02-Comment: every written answer -----------------------------------------------------------
  const writtenQuestions = report.sections.flatMap((section) => section.questions.filter((question) => question.kind === "TEXT"));
  edit(COMMENT, (xml) => {
    const lastColumnLetter = columnLetter(1 + Math.max(writtenQuestions.length, 1));
    const header = rowXml(
      3,
      writtenQuestions.map((question, index) => cellXml(`${columnLetter(2 + index)}3`, "160", question.header)),
      ' s="161" customFormat="1" ht="26.4"',
    );
    const rows = report.respondents
      .map((_, rowIndex) =>
        rowXml(
          4 + rowIndex,
          writtenQuestions.map((question, index) => {
            const answer = question.answers[rowIndex];
            return cellXml(`${columnLetter(2 + index)}${4 + rowIndex}`, "162", typeof answer === "string" ? answer : null);
          }),
          ' s="161" customFormat="1"',
        ),
      )
      .join("");
    const lastRow = Math.max(4, 3 + report.respondents.length);
    edit(WORKBOOK, (workbook) => workbook.replace(/('02-Comment'!\$B\$1:\$)[A-Z]+\$\d+/, `$1${lastColumnLetter}$${lastRow}`));
    return replaceRowsFrom(xml, 3, header + rows)
      .replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="B1:${lastColumnLetter}${lastRow}"/>`)
      .replace(/<col min="2" max="6"/, `<col min="2" max="${1 + Math.max(writtenQuestions.length, 5)}"`);
  });

  // --- Charts ---------------------------------------------------------------------------------
  const cachedString = (value: string) =>
    `<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXlsxXml(value)}</c:v></c:pt></c:strCache>`;
  const cachedNumber = (value: number) =>
    `<c:numCache><c:formatCode>0.00</c:formatCode><c:ptCount val="1"/><c:pt idx="0"><c:v>${value}</c:v></c:pt></c:numCache>`;

  const barTemplate = read(BAR_TEMPLATE)
    .replace(/<c:pivotSource>[\s\S]*?<\/c:pivotSource>/, "")
    .replace(/<c:pivotFmts>[\s\S]*?<\/c:pivotFmts>/, "");
  const firstSeries = barTemplate.match(/<c:ser>[\s\S]*?<\/c:ser>/)![0];
  const seriesLabels = firstSeries.match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)?.[0].replace(/<c:extLst>[\s\S]*?<\/c:extLst>/g, "") ?? "";
  const barRels = read(BAR_TEMPLATE_RELS);
  const chartEntry = find(BAR_TEMPLATE);

  const barChart = (section: (typeof sectionRows)[number]) => {
    const series = section.rows
      .map(({ row, question }, index) =>
        "<c:ser>" +
        `<c:idx val="${index}"/><c:order val="${index}"/>` +
        `<c:tx><c:strRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$A$${row}`)}</c:f>${cachedString(question.header)}</c:strRef></c:tx>` +
        `<c:spPr><a:solidFill><a:schemeClr val="${RATING_COLOURS[index % RATING_COLOURS.length]}"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>` +
        '<c:invertIfNegative val="0"/>' +
        seriesLabels +
        `<c:val><c:numRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$B$${row}`)}</c:f>${cachedNumber(question.average ?? 0)}</c:numRef></c:val>` +
        "</c:ser>",
      )
      .join("");
    const firstIndex = barTemplate.indexOf("<c:ser>");
    const lastIndex = barTemplate.lastIndexOf("</c:ser>") + "</c:ser>".length;
    return (barTemplate.slice(0, firstIndex) + series + barTemplate.slice(lastIndex))
      // The title is one run per edit HRD ever made to it; collapse to one run carrying the name.
      // Keeps the first run's formatting: without it the title falls back to white on a white chart.
      .replace(/(<c:title>[\s\S]*?<a:p>[\s\S]*?)((?:<a:r>[\s\S]*?<\/a:r>)+)/, (_, head: string, runs: string) => {
        // Self-closing, or with a body - never "up to the first />", which lands inside <a:srgbClr/>.
        const runProperties = runs.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/)?.[0] ?? "";
        return `${head}<a:r>${runProperties}<a:t>${escapeXlsxXml(section.name)}</a:t></a:r>`;
      });
  };

  for (const number of TEMPLATE_BAR_CHARTS) {
    remove(`xl/charts/chart${number}.xml`);
    remove(`xl/charts/_rels/chart${number}.xml.rels`);
  }
  const chartStyle = read("xl/charts/style1.xml");
  const chartColours = read("xl/charts/colors1.xml");
  const generated = sectionRows.map((section, index) => {
    const number = 101 + index;
    add(`xl/charts/chart${number}.xml`, barChart(section), chartEntry);
    // Every chart needs its own style and colour parts: two charts pointing at one style part is a
    // workbook Excel refuses to open.
    add(`xl/charts/style${number}.xml`, chartStyle, chartEntry);
    add(`xl/charts/colors${number}.xml`, chartColours, chartEntry);
    add(
      `xl/charts/_rels/chart${number}.xml.rels`,
      barRels.replace(/Target="style1\.xml"/, `Target="style${number}.xml"`).replace(/Target="colors1\.xml"/, `Target="colors${number}.xml"`),
      chartEntry,
    );
    return { number, relationshipId: `rIdSection${index + 1}` };
  });

  // Doughnut: companies read from the calculation block.
  edit(DOUGHNUT, (xml) => {
    const labels = report.companies.map((company, index) => `<c:pt idx="${index}"><c:v>${escapeXlsxXml(company.companyCode)}</c:v></c:pt>`).join("");
    const values = report.companies.map((company, index) => `<c:pt idx="${index}"><c:v>${company.count}</c:v></c:pt>`).join("");
    const count = report.companies.length;
    return xml
      .replace(/<c:pivotSource>[\s\S]*?<\/c:pivotSource>/, "")
      .replace(/<c:pivotFmts>[\s\S]*?<\/c:pivotFmts>/, "")
      .replace(
        /<c:cat>[\s\S]*?<\/c:cat>/,
        `<c:cat><c:strRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$A$${COMPANY_FIRST_ROW}:$A$${companyLastRow}`)}</c:f><c:strCache><c:ptCount val="${count}"/>${labels}</c:strCache></c:strRef></c:cat>`,
      )
      .replace(
        /<c:val>[\s\S]*?<\/c:val>/,
        `<c:val><c:numRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$B$${COMPANY_FIRST_ROW}:$B$${companyLastRow}`)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${count}"/>${values}</c:numCache></c:numRef></c:val>`,
      );
  });

  // Drawing: the template's three bar anchors out, one anchor per section in, stacked.
  edit(DRAWING, (xml) => {
    const anchors = [...xml.matchAll(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g)].map((match) => match[0]);
    const model = anchors.find((anchor) => anchor.includes(`r:id="${BAR_ANCHOR_RELATIONSHIP}"`))!;
    let withoutBars = xml;
    for (const anchor of anchors.filter((item) => TEMPLATE_BAR_RELATIONSHIPS.some((id) => item.includes(`r:id="${id}"`)))) {
      withoutBars = withoutBars.replace(anchor, "");
    }
    const added = generated
      .map(({ relationshipId }, index) => {
        const top = CHART_FIRST_ROW + index * CHART_ROWS;
        return model
          .replace(/<xdr:from>([\s\S]*?)<xdr:row>\d+<\/xdr:row>/, `<xdr:from>$1<xdr:row>${top}</xdr:row>`)
          .replace(/<xdr:to>([\s\S]*?)<xdr:row>\d+<\/xdr:row>/, `<xdr:to>$1<xdr:row>${top + CHART_ROWS - 1}</xdr:row>`)
          .replace(/<xdr:cNvPr id="\d+" name="[^"]*">/, `<xdr:cNvPr id="${900 + index}" name="Section chart ${index + 1}">`)
          .replace(/<a:extLst>[\s\S]*?<\/a:extLst>/, "")
          .replace(`r:id="${BAR_ANCHOR_RELATIONSHIP}"`, `r:id="${relationshipId}"`);
      })
      .join("");
    return withoutBars.replace("</xdr:wsDr>", `${added}</xdr:wsDr>`);
  });
  edit(DRAWING_RELS, (xml) => {
    let rels = xml;
    for (const id of TEMPLATE_BAR_RELATIONSHIPS) rels = rels.replace(new RegExp(`<Relationship Id="${id}"[^>]*/>`), "");
    const added = generated
      .map(({ number, relationshipId }) =>
        `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${number}.xml"/>`,
      )
      .join("");
    return rels.replace("</Relationships>", `${added}</Relationships>`);
  });

  // The calculation chain lists cells that no longer hold those formulas; Excel rebuilds it.
  remove("xl/calcChain.xml");
  edit(WORKBOOK_RELS, (xml) => xml.replace(/<Relationship [^>]*Target="calcChain.xml"\/>/, ""));
  edit(CONTENT_TYPES, (xml) => {
    let types = xml.replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, "");
    for (const number of TEMPLATE_BAR_CHARTS) types = types.replace(new RegExp(`<Override PartName="/xl/charts/chart${number}.xml"[^>]*/>`), "");
    const added = generated
      .map(
        ({ number }) =>
          `<Override PartName="/xl/charts/chart${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
          `<Override PartName="/xl/charts/style${number}.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>` +
          `<Override PartName="/xl/charts/colors${number}.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>`,
      )
      .join("");
    return types.replace("</Types>", `${added}</Types>`);
  });

  return writeXlsxEntries(entries);
};
