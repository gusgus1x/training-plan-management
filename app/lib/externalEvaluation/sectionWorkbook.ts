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
/** Formulas reach at least this far down so a reply typed in later still counts. */
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
/** The first row of the printed dashboard, which is where page one starts counting. */
const PRINT_FIRST_ROW = 3;
/** Rows one printed page holds at the template's own scale; the template's page one is 3..77. */
const ROWS_PER_PAGE = 75;
/**
 * How tall one chart is drawn, in rows. A fixed height made every bar past about ten too thin to
 * read and cut the labels off the legend, which is where the old "10 questions per section" limit
 * came from; growing with the bar count removes it.
 */
const chartRows = (bars: number) => Math.max(16, 6 + Math.ceil(bars * 1.4));
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
  // Room for replies typed in later, and never short of the replies already here: a fixed 5,000
  // silently left every row past it out of the averages.
  const lastFormulaRow = Math.max(LAST_FORMULA_ROW, lastDataRow + 1000);
  const rangeOf = (column: number) =>
    `${DATABASE_SHEET}!$${columnLetter(column)}$${FIRST_DATA_ROW}:$${columnLetter(column)}$${lastFormulaRow}`;

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
  /**
   * One chart to draw. `entries` is one bar per row of the calculation block; `matrix` is a grid
   * question, whose bars are its rows crossed with its columns.
   */
  type ChartSpec = {
    title: string;
    /** A choice question is read as slices of one question, the way the screen draws it. */
    shape: "bar" | "doughnut";
    /** Top of the value axis: the rating scale, or 100 for a chart of percentages. Bars only. */
    max: number;
    bars: number;
    entries?: Array<{ row: number; label: string; value: number }>;
    matrix?: { firstRow: number; lastRow: number; rowLabels: string[]; columns: string[]; values: number[][] };
  };
  const specs: ChartSpec[] = [];
  /** Where each chart ends up, and the page breaks that keep them whole. */
  const placed: Array<{ spec: ChartSpec; top: number; rows: number }> = [];
  const breaks: number[] = [];
  edit(REPORT, (xml) => {
    let sheet = xml;
    sheet = setCell(sheet, "A2", "Company");
    sheet = setCell(sheet, "B2", "Responds");
    report.companies.forEach((company, index) => {
      const row = COMPANY_FIRST_ROW + index;
      sheet = setCell(sheet, `A${row}`, company.companyCode);
      sheet = setFormula(sheet, `B${row}`, `COUNTIF(${DATABASE_SHEET}!$F$${FIRST_DATA_ROW}:$F$${lastFormulaRow},A${row})`, company.count);
    });

    let row = companyLastRow + 2;
    for (const section of report.sections) {
      const ratings = section.questions.filter((question) => question.kind === "RATING");
      // A grid row scored by column position has its own scale, so it cannot share an axis with the
      // 1-5 questions: one chart per scale, named for the scale when it is not the usual five.
      const scales = [...new Set(ratings.map((question) => question.outOf ?? 5))];
      for (const scale of scales) {
        const scored = ratings.filter((question) => (question.outOf ?? 5) === scale);
        const title = scale === 5 ? section.name : `${section.name} (เต็ม ${scale})`;
        sheet = setCell(sheet, `A${row}`, title);
        row += 1;
        const entries: NonNullable<ChartSpec["entries"]> = [];
        for (const question of scored) {
          sheet = setCell(sheet, `A${row}`, question.header);
          sheet = setFormula(sheet, `B${row}`, `IFERROR(ROUND(AVERAGE(${rangeOf(columnOf.get(question)!)}),2),0)`, question.average ?? 0);
          entries.push({ row, label: question.header, value: question.average ?? 0 });
          row += 1;
        }
        specs.push({ title, shape: "bar", max: scale, bars: entries.length, entries });
        row += 1;
      }

      for (const question of section.questions.filter((item) => item.kind === "CHOICE")) {
        const split = question.split ?? [];
        if (!split.length) continue;
        sheet = setCell(sheet, `A${row}`, question.header);
        row += 1;
        const entries: NonNullable<ChartSpec["entries"]> = [];
        for (const option of split) {
          sheet = setCell(sheet, `A${row}`, option.label);
          // ponytail: a share, written as the number it was when the file was made. Editing
          // 01-Database in Excel will not move it; swap in a COUNTIF when HRD asks for that.
          sheet = setCell(sheet, `B${row}`, option.percent);
          entries.push({ row, label: option.label, value: option.percent });
          row += 1;
        }
        specs.push({ title: question.header, shape: "doughnut", max: 100, bars: entries.length, entries });
        row += 1;
      }

      for (const question of section.questions.filter((item) => item.kind === "GRID")) {
        const grid = question.gridSplit;
        if (!grid?.rows.length || !grid.columns.length) continue;
        sheet = setCell(sheet, `A${row}`, question.header);
        row += 1;
        const firstRow = row;
        grid.rows.forEach((label, rowIndex) => {
          sheet = setCell(sheet, `A${row}`, label);
          grid.columns.forEach((_, columnIndex) => {
            sheet = setCell(sheet, `${columnLetter(2 + columnIndex)}${row}`, grid.percent[rowIndex]?.[columnIndex] ?? 0);
          });
          row += 1;
        });
        specs.push({
          title: `${question.header} (%)`,
          shape: "bar",
          max: 100,
          bars: grid.rows.length * grid.columns.length,
          matrix: { firstRow, lastRow: row - 1, rowLabels: grid.rows, columns: grid.columns, values: grid.percent },
        });
        row += 1;
      }
    }

    // Charts stacked from CHART_FIRST_ROW, each as tall as it needs, starting a new page rather
    // than crossing one.
    let top = CHART_FIRST_ROW;
    let pageStart = PRINT_FIRST_ROW;
    for (const spec of specs) {
      const rows = chartRows(spec.bars);
      if (top + rows - pageStart > ROWS_PER_PAGE && top > pageStart) {
        breaks.push(top);
        pageStart = top;
      }
      placed.push({ spec, top, rows });
      top += rows;
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
    // The company form shows only its Part 4 here, so its other sections opt out.
    let commentRow = COMMENT_FIRST_ROW;
    const answerMerges: string[] = [];
    for (const section of report.sections) {
      if (section.showComments === false) continue;
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

    const lastChartRow = placed.length ? placed[placed.length - 1].top + placed[placed.length - 1].rows : CHART_FIRST_ROW;
    const printLast = Math.max(PRINT_LAST_ROW, lastChartRow + 1, commentRow);
    // A manual break at the top of a chart that would straddle a page, so the print never cuts one
    // in half. Without them the page fitted three charts and everything past that was the "limit".
    sheet = sheet.replace(/<rowBreaks[\s\S]*?<\/rowBreaks>|<rowBreaks[^>]*\/>/, "");
    if (breaks.length) {
      // A drawing row is zero-based and `brk id` is the last row of the page, so the id is the
      // chart's own top: one less split the chart above it across two pages.
      const brk = breaks.map((top) => `<brk id="${top}" max="16383" man="1"/>`).join("");
      sheet = sheet.replace(
        /<drawing /,
        `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${brk}</rowBreaks><drawing `,
      );
    }
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
  const cachedStrings = (values: string[]) =>
    `<c:strCache><c:ptCount val="${values.length}"/>` +
    values.map((value, index) => `<c:pt idx="${index}"><c:v>${escapeXlsxXml(value)}</c:v></c:pt>`).join("") +
    "</c:strCache>";
  const cachedNumbers = (values: number[]) =>
    `<c:numCache><c:formatCode>0.00</c:formatCode><c:ptCount val="${values.length}"/>` +
    values.map((value, index) => `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`).join("") +
    "</c:numCache>";

  const barTemplate = read(BAR_TEMPLATE)
    .replace(/<c:pivotSource>[\s\S]*?<\/c:pivotSource>/, "")
    .replace(/<c:pivotFmts>[\s\S]*?<\/c:pivotFmts>/, "");
  const firstSeries = barTemplate.match(/<c:ser>[\s\S]*?<\/c:ser>/)![0];
  const seriesLabels = firstSeries.match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)?.[0].replace(/<c:extLst>[\s\S]*?<\/c:extLst>/g, "") ?? "";
  const barRels = read(BAR_TEMPLATE_RELS);
  const chartEntry = find(BAR_TEMPLATE);

  const seriesXml = (index: number, title: string, body: string) =>
    "<c:ser>" +
    `<c:idx val="${index}"/><c:order val="${index}"/>${title}` +
    `<c:spPr><a:solidFill><a:schemeClr val="${RATING_COLOURS[index % RATING_COLOURS.length]}"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>` +
    '<c:invertIfNegative val="0"/>' +
    seriesLabels +
    body +
    "</c:ser>";

  const barChart = (spec: ChartSpec) => {
    const series = spec.matrix
      ? // One series per column of the grid, its bars the rows: the shape a grid question is read in.
        spec.matrix.columns
          .map((column, columnIndex) => {
            const values = spec.matrix!.values.map((rowValues) => rowValues[columnIndex] ?? 0);
            const letter = columnLetter(2 + columnIndex);
            return seriesXml(
              columnIndex,
              `<c:tx><c:v>${escapeXlsxXml(column)}</c:v></c:tx>`,
              `<c:cat><c:strRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$A$${spec.matrix!.firstRow}:$A$${spec.matrix!.lastRow}`)}</c:f>${cachedStrings(spec.matrix!.rowLabels)}</c:strRef></c:cat>` +
                `<c:val><c:numRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$${letter}$${spec.matrix!.firstRow}:$${letter}$${spec.matrix!.lastRow}`)}</c:f>${cachedNumbers(values)}</c:numRef></c:val>`,
            );
          })
          .join("")
      : (spec.entries ?? [])
          .map((entry, index) =>
            seriesXml(
              index,
              `<c:tx><c:strRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$A$${entry.row}`)}</c:f>${cachedString(entry.label)}</c:strRef></c:tx>`,
              `<c:val><c:numRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$B$${entry.row}`)}</c:f>${cachedNumber(entry.value)}</c:numRef></c:val>`,
            ),
          )
          .join("");
    const firstIndex = barTemplate.indexOf("<c:ser>");
    const lastIndex = barTemplate.lastIndexOf("</c:ser>") + "</c:ser>".length;
    return (barTemplate.slice(0, firstIndex) + series + barTemplate.slice(lastIndex))
      // The value axis is the one with a max; the category axis has none to replace.
      .replace(/<c:max val="[\d.]+"\/>/, `<c:max val="${spec.max}"/>`)
      // The template steps the axis by 1, which is right up to 5 and unreadable at 100: a hundred
      // tick labels crushed into one strip under the bars.
      .replace(/<c:majorUnit val="[\d.]+"\/>/, `<c:majorUnit val="${spec.max <= 10 ? 1 : Math.round(spec.max / 5)}"/>`)
      // A grid's bars are its rows, so the category axis has to be readable. The template hides it
      // because its own charts carry one bar per series and name them in the legend instead.
      .replace(/<c:catAx>[\s\S]*?<\/c:catAx>/, (axis) =>
        spec.matrix ? axis.replace(/<c:delete val="1"\/>/, '<c:delete val="0"/>') : axis,
      )
      // The title is one run per edit HRD ever made to it; collapse to one run carrying the name.
      // Keeps the first run's formatting: without it the title falls back to white on a white chart.
      .replace(/(<c:title>[\s\S]*?<a:p>[\s\S]*?)((?:<a:r>[\s\S]*?<\/a:r>)+)/, (_, head: string, runs: string) => {
        // Self-closing, or with a body - never "up to the first />", which lands inside <a:srgbClr/>.
        const runProperties = runs.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/)?.[0] ?? "";
        return `${head}<a:r>${runProperties}<a:t>${escapeXlsxXml(spec.title)}</a:t></a:r>`;
      });
  };

  /**
   * A choice question as slices, cloned from the template's own company doughnut - same ring, same
   * legend, same fonts. Its one series reads the option labels and their shares out of the
   * calculation block.
   */
  const doughnutTemplate = read(DOUGHNUT);
  const doughnutChart = (spec: ChartSpec) => {
    const entries = spec.entries ?? [];
    const firstRow = entries[0]?.row ?? 1;
    const lastRow = entries[entries.length - 1]?.row ?? firstRow;
    return doughnutTemplate
      .replace(/<c:pivotSource>[\s\S]*?<\/c:pivotSource>/, "")
      .replace(/<c:pivotFmts>[\s\S]*?<\/c:pivotFmts>/, "")
      .replace(
        /<c:cat>[\s\S]*?<\/c:cat>/,
        `<c:cat><c:strRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$A$${firstRow}:$A$${lastRow}`)}</c:f>${cachedStrings(entries.map((entry) => entry.label))}</c:strRef></c:cat>`,
      )
      .replace(
        /<c:val>[\s\S]*?<\/c:val>/,
        `<c:val><c:numRef><c:f>${escapeXlsxXml(`${REPORT_SHEET}!$B$${firstRow}:$B$${lastRow}`)}</c:f>${cachedNumbers(entries.map((entry) => entry.value))}</c:numRef></c:val>`,
      )
      // The title is rich text here rather than a formula; swap the runs for the question.
      .replace(/(<c:title>[\s\S]*?<a:p>[\s\S]*?)((?:<a:r>[\s\S]*?<\/a:r>)+)/, (_, head: string, runs: string) => {
        const runProperties = runs.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/)?.[0] ?? "";
        return `${head}<a:r>${runProperties}<a:t>${escapeXlsxXml(spec.title)}</a:t></a:r>`;
      });
  };

  for (const number of TEMPLATE_BAR_CHARTS) {
    remove(`xl/charts/chart${number}.xml`);
    remove(`xl/charts/_rels/chart${number}.xml.rels`);
  }
  const chartStyle = read("xl/charts/style1.xml");
  const chartColours = read("xl/charts/colors1.xml");
  const generated = placed.map(({ spec }, index) => {
    const number = 101 + index;
    const doughnut = spec.shape === "doughnut";
    add(`xl/charts/chart${number}.xml`, doughnut ? doughnutChart(spec) : barChart(spec), chartEntry);
    if (!doughnut) {
      // Every bar chart needs its own style and colour parts: two charts pointing at one style part
      // is a workbook Excel refuses to open. The template's doughnut carries neither.
      add(`xl/charts/style${number}.xml`, chartStyle, chartEntry);
      add(`xl/charts/colors${number}.xml`, chartColours, chartEntry);
      add(
        `xl/charts/_rels/chart${number}.xml.rels`,
        barRels.replace(/Target="style1\.xml"/, `Target="style${number}.xml"`).replace(/Target="colors1\.xml"/, `Target="colors${number}.xml"`),
        chartEntry,
      );
    }
    return { number, relationshipId: `rIdSection${index + 1}`, doughnut };
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
        const { top, rows } = placed[index];
        return model
          .replace(/<xdr:from>([\s\S]*?)<xdr:row>\d+<\/xdr:row>/, `<xdr:from>$1<xdr:row>${top}</xdr:row>`)
          .replace(/<xdr:to>([\s\S]*?)<xdr:row>\d+<\/xdr:row>/, `<xdr:to>$1<xdr:row>${top + rows - 1}</xdr:row>`)
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
        ({ number, doughnut }) =>
          `<Override PartName="/xl/charts/chart${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
          (doughnut
            ? ""
            : `<Override PartName="/xl/charts/style${number}.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>` +
              `<Override PartName="/xl/charts/colors${number}.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>`),
      )
      .join("");
    return types.replace("</Types>", `${added}</Types>`);
  });

  return writeXlsxEntries(entries);
};
