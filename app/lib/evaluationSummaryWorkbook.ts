import { escapeXlsxXml, readXlsxEntries, writeXlsxEntries, type XlsxEntry } from "./xlsxTemplate";
import type {
  EvaluationResponse,
  EvaluationResponseList,
  EvaluationSummary,
  EvaluationSummaryQuestion,
} from "./trainingForms/types";

/**
 * The evaluation report, written into `app/Excel/Evaluation_Form_Tem.xlsx`.
 *
 * The template is a skeleton, not a finished report: three sheets, four charts that point at
 * nothing, and a row of column headings. Everything else - the response columns, the chart data,
 * the charts themselves - is generated here from the form that was actually answered.
 *
 * That is the point of it. The previous template hung off a pivot cache built on 29 fixed fields,
 * which capped the export at twelve rating questions and seven written ones. Here nothing is fixed:
 * a form with thirty questions gets thirty columns and thirty charts. The cost is that the chart
 * XML has to be written rather than filled in, which is what most of this file does.
 *
 * Layout, in the order the sheets appear:
 *
 * - `Form Responses` - one row per reply, in the shape Microsoft Forms exports: the system columns
 *   first, then one column per question.
 * - `Dashboard` - course header, the two counts, the doughnut of replies by company, one bar chart
 *   per question, and a preview of the written answers.
 * - `Comments` - every written question and answer, question across, respondent down.
 * - `ChartData` - hidden. What the charts read. Nobody is meant to open it.
 */

const RESPONSES = "xl/worksheets/sheet1.xml";
const DASHBOARD = "xl/worksheets/sheet2.xml";
const COMMENTS = "xl/worksheets/sheet3.xml";
/** Created by this writer; the template has three sheets. */
const CHART_DATA = "xl/worksheets/sheet4.xml";
const WORKBOOK = "xl/workbook.xml";
const WORKBOOK_RELS = "xl/_rels/workbook.xml.rels";
const CONTENT_TYPES = "[Content_Types].xml";
const DRAWING = "xl/drawings/drawing1.xml";
const DRAWING_RELS = "xl/drawings/_rels/drawing1.xml.rels";
/** The two charts the template drew, kept only as the shapes every generated chart is cut from. */
const DOUGHNUT_TEMPLATE = "xl/charts/chart1.xml";
const BAR_TEMPLATE = "xl/charts/chart2.xml";

/** `Form Responses`: the system columns, then one column per question from H. */
const FIRST_QUESTION_COLUMN = 8;
const RESPONSE_HEADER_STYLE = "1";
const RESPONSE_SYSTEM_STYLE = "2";
const RESPONSE_ANSWER_STYLE = "22";

/** `Comments`: questions across row 3, answers from row 4, the running number in column A. */
const COMMENT_HEADER_ROW = 3;
const COMMENT_FIRST_ROW = 4;
/**
 * The template styles its first two columns and leaves the rest bare, because it was drawn with one
 * question in mind. Every question column gets the same yellow heading and the same bordered body,
 * however many the form turns out to have.
 */
const COMMENT_HEADER_STYLE = "10";
const COMMENT_NUMBER_STYLE = "11";
const COMMENT_ANSWER_STYLE = "12";

/** `Dashboard`: where the generated charts stack, and how tall each one is in rows. */
const FIRST_CHART_ROW = 17;
const CHART_ROW_HEIGHT = 11;
const CHART_ROW_GAP = 1;
/** The written answers previewed under the "Comments Preview" heading, in column G. */
const PREVIEW_FIRST_ROW = 20;
const PREVIEW_LAST_ROW = 47;
const PREVIEW_ANSWERS_PER_QUESTION = 5;
const PREVIEW_QUESTION_STYLE = "9";
const PREVIEW_ANSWER_STYLE = "8";

/** What stands in for a name on a form that promised not to keep one. */
const ANONYMOUS = "anonymous";

/** Ratings are answered on a fixed 1-5 scale, so a value nobody picked is still a bar at zero. */
const RATING_VALUES = [1, 2, 3, 4, 5];

const columnLetter = (index: number) => {
  let letters = "";
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) {
    letters = String.fromCharCode(65 + ((value - 1) % 26)) + letters;
  }
  return letters;
};

const cellXml = (reference: string, style: string | undefined, value: string | number | null) => {
  const attrs = `r="${reference}"${style ? ` s="${style}"` : ""}`;
  if (value === null || value === "") return `<c ${attrs}/>`;
  if (typeof value === "number") return `<c ${attrs}><v>${value}</v></c>`;
  return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${escapeXlsxXml(value)}</t></is></c>`;
};

/**
 * One element, whether the template wrote it self-closing or with a body.
 *
 * The quantifier before the alternation is lazy on purpose. Greedy, it runs past the `/` of an
 * empty element, fails to match `/>`, and settles for the second branch instead - swallowing every
 * element up to the next closing tag, which is a whole row of somebody else's cells.
 */
const elementPattern = (tag: string, reference: string) =>
  new RegExp(`<${tag}\\b[^>]*?\\br="${reference}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`);

const cellPattern = (reference: string) => elementPattern("c", reference);

const styleOf = (worksheet: string, reference: string) =>
  cellPattern(reference).exec(worksheet)?.[0].match(/\bs="([^"]+)"/)?.[1];

/** Writes a cell, whether or not the template drew one there, keeping any formatting it had. */
const setCell = (
  worksheet: string,
  reference: string,
  value: string | number | null,
  fallbackStyle?: string,
) => {
  const existing = cellPattern(reference).exec(worksheet);
  const cell = cellXml(reference, styleOf(worksheet, reference) ?? fallbackStyle, value);
  if (existing) return worksheet.replace(existing[0], cell);
  if (value === null || value === "") return worksheet;

  const row = Number(/\d+/.exec(reference)![0]);
  const rowMatch = elementPattern("row", String(row)).exec(worksheet);
  if (rowMatch) {
    // An empty row is written self-closing and has to be opened up before a cell can go in it.
    const opened = rowMatch[0].endsWith("/>")
      ? `${rowMatch[0].slice(0, -2)}>${cell}</row>`
      : rowMatch[0].replace("</row>", `${cell}</row>`);
    return worksheet.replace(rowMatch[0], opened);
  }

  // Rows have to stay in ascending order or Excel calls the file corrupt.
  const rows = [...worksheet.matchAll(/<row\b[^>]*?\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)];
  const next = rows.find((candidate) => Number(candidate[1]) > row);
  const newRow = `<row r="${row}">${cell}</row>`;
  return next
    ? worksheet.replace(next[0], `${newRow}${next[0]}`)
    : worksheet.replace("</sheetData>", `${newRow}</sheetData>`);
};

const replaceRowsFrom = (worksheet: string, firstRow: number, rows: string) => {
  const start = worksheet.search(new RegExp(`<row\\b[^>]*\\br="${firstRow}"`));
  const end = worksheet.indexOf("</sheetData>");
  return start === -1
    ? worksheet.slice(0, end) + rows + worksheet.slice(end)
    : worksheet.slice(0, start) + rows + worksheet.slice(end);
};

// --- What the form asks, flattened into columns ------------------------------------------------

type QuestionKind = "RATING" | "CHOICE" | "GRID" | "TEXT";

/** One column of `Form Responses`: a question, or one row of a grid question. */
type ResponseColumn = {
  header: string;
  question: EvaluationSummaryQuestion;
  kind: QuestionKind;
  /** Grid columns only - which row of the grid this column carries. */
  gridRowText: string | null;
};

/** One chart on the dashboard: a title and the bars under it. */
type ChartBlock = { title: string; points: { label: string; value: number }[] };

const kindOf = (question: EvaluationSummaryQuestion): QuestionKind | null => {
  switch (question.questionType) {
    case "RATING":
      return "RATING";
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return "CHOICE";
    case "MULTIPLE_CHOICE_GRID":
    case "CHECKBOX_GRID":
      return "GRID";
    case "SHORT_TEXT":
    case "LONG_TEXT":
      return "TEXT";
    default:
      // Section breaks and text blocks are not questions and have no column.
      return null;
  }
};

/**
 * The columns of the response sheet, in form order.
 *
 * A grid becomes one column per row, headed `question [row]`. That is Google Forms' shape, and it
 * is deliberately not Microsoft's: theirs repeats the whole question text in every column of the
 * grid, which their own users have asked them to stop doing.
 */
const responseColumns = (summary: EvaluationSummary): ResponseColumn[] => {
  const columns: ResponseColumn[] = [];
  for (const question of summary.questions) {
    const kind = kindOf(question);
    if (kind === null) continue;
    if (kind === "GRID") {
      for (const row of question.gridRows) {
        columns.push({
          header: `${question.questionText} [${row.rowText}]`,
          question,
          kind,
          gridRowText: row.rowText,
        });
      }
      continue;
    }
    columns.push({ header: question.questionText, question, kind, gridRowText: null });
  }
  return columns;
};

/** What one person answered, as the cell for one column. */
const answerFor = (response: EvaluationResponse, column: ResponseColumn): string | number | null => {
  const answer = response.answers.find((item) => item.questionId === column.question.questionId);
  if (!answer) return null;
  if (column.kind === "TEXT") return answer.text ?? null;
  if (column.kind === "RATING") return answer.ratingValue;
  if (column.kind === "CHOICE") return answer.choices.join(", ") || null;
  // A grid answer is stored as "row: column", so the row this column carries picks its own out.
  const prefix = `${column.gridRowText}: `;
  const picked = answer.choices
    .filter((choice) => choice.startsWith(prefix))
    .map((choice) => choice.slice(prefix.length));
  return picked.join(", ") || null;
};

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/**
 * One chart per answerable column: how the replies split across the choices, as a percentage of the
 * people who answered that question. A rating keeps all five values even where nobody picked one,
 * because a missing bar reads as a missing question.
 */
const chartFor = (column: ResponseColumn): ChartBlock | null => {
  const { question } = column;
  if (column.kind === "TEXT") return null;
  if (column.kind === "RATING") {
    const answered = question.ratingDistribution.reduce((total, entry) => total + entry.count, 0);
    return {
      title: question.questionText,
      points: RATING_VALUES.map((value) => ({
        label: String(value),
        value: percent(
          question.ratingDistribution.find((entry) => entry.value === value)?.count ?? 0,
          answered,
        ),
      })),
    };
  }
  if (column.kind === "CHOICE") {
    return {
      title: question.questionText,
      points: question.options.map((option) => ({ label: option.optionText, value: option.percent })),
    };
  }
  const row = question.gridRows.find((item) => item.rowText === column.gridRowText);
  if (!row) return null;
  return {
    title: column.header,
    points: row.cells.map((cell) => ({ label: cell.columnText, value: cell.percent })),
  };
};

// --- Chart XML ---------------------------------------------------------------------------------

const numberCache = (points: ChartBlock["points"]) =>
  `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${points.length}"/>` +
  points.map((point, index) => `<c:pt idx="${index}"><c:v>${point.value}</c:v></c:pt>`).join("") +
  "</c:numCache>";

const stringCache = (points: ChartBlock["points"]) =>
  `<c:strCache><c:ptCount val="${points.length}"/>` +
  points
    .map((point, index) => `<c:pt idx="${index}"><c:v>${escapeXlsxXml(point.label)}</c:v></c:pt>`)
    .join("") +
  "</c:strCache>";

/**
 * A chart part, cut from one of the template's own charts so it keeps its colours, fonts and data
 * labels, with the series repointed at the hidden sheet.
 *
 * The values are written into the cache as well as referenced. A reader that recalculates gets the
 * same numbers either way; one that does not - a preview pane, a phone - still draws the chart
 * instead of an empty frame.
 */
const chartXml = (template: string, block: ChartBlock, labels: string, values: string) => {
  const series =
    `<c:cat><c:strRef><c:f>${labels}</c:f>${stringCache(block.points)}</c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${values}</c:f>${numberCache(block.points)}</c:numRef></c:val>`;

  return (
    template
      // The leftover `#REF!` extension carries a filtered category that no longer exists.
      .replace(
        /<c:extLst><c:ext uri="\{02D57815-91ED-43cb-92C2-25804820EDAC\}"[\s\S]*?<\/c:extLst><\/c:ser>/,
        "</c:ser>",
      )
      .replace(/<c:val><c:numRef>[\s\S]*?<\/c:numRef><\/c:val>/, series)
      .replace(/(<c:title>[\s\S]*?)<a:t>[\s\S]*?<\/a:t>/, `$1<a:t>${escapeXlsxXml(block.title)}</a:t>`)
  );
};

const chartAnchor = (relationshipId: string, id: number, name: string, top: number, bottom: number) =>
  "<xdr:twoCellAnchor>" +
  `<xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${top}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
  `<xdr:to><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${bottom}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
  `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${name}"/>` +
  "<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>" +
  '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
  '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relationshipId}"/>` +
  "</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>";

// --- Formatting --------------------------------------------------------------------------------

const thaiDate = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(iso));

const thaiDateRange = (startAt: string, endAt: string) => {
  const start = thaiDate(startAt);
  const end = thaiDate(endAt);
  return start === end ? start : `${start} - ${end}`;
};

/**
 * The two timestamp columns, to the second: `12/08/2569 14:03:41`.
 *
 * The seconds matter here in a way they do not elsewhere, because these two columns are what the
 * average answering time is computed from, and a reader checking that number needs to see the
 * difference the report claims. Written as text rather than as an Excel serial date, like every
 * other value this writer produces.
 */
const thaiDateTime = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));

const splitName = (name: string | null) => {
  if (name === null) return { firstName: null, lastName: null };
  const parts = name.trim().split(/\s+/);
  // A Thai name arrives as "คำนำหน้า ชื่อ นามสกุล": the surname is the last word.
  return parts.length < 2
    ? { firstName: name, lastName: null }
    : { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
};

export const buildEvaluationSummaryWorkbook = (
  template: Buffer,
  summary: EvaluationSummary,
  responses: EvaluationResponseList | null,
): Buffer => {
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
  const add = (name: string, xml: string) => {
    const model = find(RESPONSES);
    entries.push({ ...model, name, data: Buffer.from(xml, "utf8") });
  };

  const columns = responseColumns(summary);
  const people = responses?.responses ?? [];
  const isAnonymous = summary.isAnonymous;

  // --- Form Responses ------------------------------------------------------------------------
  edit(RESPONSES, (xml) => {
    let worksheet = xml;
    const lastColumn = FIRST_QUESTION_COLUMN + columns.length - 1;

    const header =
      `<row r="1" spans="1:${lastColumn}" ht="45" customHeight="1">` +
      ["ID", "Start time", "Completion time", "Employee ID", "Frist Name", "Last Name", "Company"]
        .map((title, index) => cellXml(`${columnLetter(index + 1)}1`, RESPONSE_HEADER_STYLE, title))
        .join("") +
      columns
        .map((column, index) =>
          cellXml(`${columnLetter(FIRST_QUESTION_COLUMN + index)}1`, RESPONSE_HEADER_STYLE, column.header),
        )
        .join("") +
      "</row>";

    const rows = people
      .map((person, index) => {
        const row = index + 2;
        const { firstName, lastName } = splitName(person.respondentName);
        // Both columns carry the full time, on an anonymous form too, at HRD's request: they are
        // what the average answering time is worked out from, and a date alone cannot show it.
        // The cost is real - a submission time set beside an attendance list points at a person -
        // and it is the same trade already made for the company column.
        const moment = (iso: string | null) => (iso === null ? null : thaiDateTime(iso));

        const cells = [
          cellXml(`A${row}`, RESPONSE_SYSTEM_STYLE, person.responseNo),
          cellXml(`B${row}`, RESPONSE_SYSTEM_STYLE, moment(person.startedAt)),
          cellXml(`C${row}`, RESPONSE_SYSTEM_STYLE, moment(person.submittedAt)),
          // An anonymous reply says so in every column that would have named somebody, rather than
          // leaving three blanks that read as missing data.
          cellXml(
            `D${row}`,
            RESPONSE_SYSTEM_STYLE,
            isAnonymous ? ANONYMOUS : person.employeeCode ?? person.responseNo,
          ),
          cellXml(`E${row}`, RESPONSE_SYSTEM_STYLE, isAnonymous ? ANONYMOUS : firstName),
          cellXml(`F${row}`, RESPONSE_SYSTEM_STYLE, isAnonymous ? ANONYMOUS : lastName),
          // The company is not one of them: HRD asked for it on anonymous forms too, so the report
          // can still split the replies by company.
          cellXml(`G${row}`, RESPONSE_SYSTEM_STYLE, person.companyCode),
          ...columns.map((column, position) =>
            cellXml(
              `${columnLetter(FIRST_QUESTION_COLUMN + position)}${row}`,
              RESPONSE_ANSWER_STYLE,
              answerFor(person, column),
            ),
          ),
        ].join("");
        return `<row r="${row}" spans="1:${lastColumn}">${cells}</row>`;
      })
      .join("");

    worksheet = replaceRowsFrom(worksheet, 1, header + rows);
    return worksheet.replace(
      /<dimension ref="[^"]+"\/>/,
      `<dimension ref="A1:${columnLetter(lastColumn)}${Math.max(1, people.length + 1)}"/>`,
    );
  });

  // --- ChartData, hidden ----------------------------------------------------------------------
  const companyBlock: ChartBlock = {
    title: "Company",
    points: summary.respondentsByCompany.map((company) => ({
      label: company.companyCode,
      value: company.count,
    })),
  };
  const questionBlocks = columns
    .map((column) => chartFor(column))
    .filter((block): block is ChartBlock => block !== null && block.points.length > 0);

  const blocks = [companyBlock, ...questionBlocks];
  const ranges: { labels: string; values: string }[] = [];
  const chartDataRows: string[] = [];
  let nextRow = 1;
  for (const block of blocks) {
    const first = nextRow + 1;
    const last = first + block.points.length - 1;
    chartDataRows.push(`<row r="${nextRow}">${cellXml(`A${nextRow}`, undefined, block.title)}</row>`);
    block.points.forEach((point, index) => {
      const row = first + index;
      chartDataRows.push(
        `<row r="${row}">${cellXml(`A${row}`, undefined, point.label)}${cellXml(`B${row}`, undefined, point.value)}</row>`,
      );
    });
    ranges.push({
      labels: `ChartData!$A$${first}:$A$${last}`,
      values: `ChartData!$B$${first}:$B$${last}`,
    });
    // One blank row between blocks, so the sheet stays readable if anybody ever unhides it.
    nextRow = last + 2;
  }

  add(
    CHART_DATA,
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<dimension ref="A1:B${Math.max(1, nextRow)}"/><sheetData>${chartDataRows.join("")}</sheetData></worksheet>`,
  );

  edit(WORKBOOK, (xml) =>
    xml.replace(
      "</sheets>",
      '<sheet name="ChartData" sheetId="99" r:id="rIdChartData"/></sheets>',
    ),
  );
  edit(WORKBOOK_RELS, (xml) =>
    xml.replace(
      "</Relationships>",
      '<Relationship Id="rIdChartData" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
        'Target="worksheets/sheet4.xml"/></Relationships>',
    ),
  );

  // --- The charts -----------------------------------------------------------------------------
  const doughnutTemplate = read(DOUGHNUT_TEMPLATE);
  const barTemplate = read(BAR_TEMPLATE);
  // Every chart in the archive is replaced: the template drew four, and a form decides how many
  // there really are.
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].name.startsWith("xl/charts/")) entries.splice(index, 1);
  }

  const charts = [
    { xml: chartXml(doughnutTemplate, companyBlock, ranges[0].labels, ranges[0].values), name: "Company" },
    ...questionBlocks.map((block, index) => ({
      xml: chartXml(barTemplate, block, ranges[index + 1].labels, ranges[index + 1].values),
      name: block.title,
    })),
  ];
  charts.forEach((chart, index) => add(`xl/charts/chart${index + 1}.xml`, chart.xml));

  edit(DRAWING_RELS, (xml) => {
    const pictures = [...xml.matchAll(/<Relationship[^>]*\/>/g)]
      .map((match) => match[0])
      .filter((relationship) => relationship.includes("/image"));
    const chartRelationships = charts.map(
      (_, index) =>
        `<Relationship Id="rIdChart${index}" ` +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" ' +
        `Target="../charts/chart${index + 1}.xml"/>`,
    );
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      [...pictures, ...chartRelationships].join("") +
      "</Relationships>"
    );
  });

  edit(DRAWING, (xml) => {
    // The two pictures are part of the design and keep the anchors the template gave them.
    const pictures = [...xml.matchAll(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g)]
      .map((match) => match[0])
      .filter((anchor) => anchor.includes("<xdr:pic>"));

    // The doughnut keeps its place under the two counts; the question charts stack below Summary.
    const anchors = charts.map((chart, index) => {
      const top =
        index === 0 ? 6 : FIRST_CHART_ROW + (index - 1) * (CHART_ROW_HEIGHT + CHART_ROW_GAP);
      const bottom = index === 0 ? 12 : top + CHART_ROW_HEIGHT;
      return chartAnchor(`rIdChart${index}`, 1000 + index, `Chart ${index + 1}`, top, bottom);
    });

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      [...anchors, ...pictures].join("") +
      "</xdr:wsDr>"
    );
  });

  edit(CONTENT_TYPES, (xml) => {
    const withoutCharts = xml.replace(
      /<Override[^>]*PartName="\/xl\/charts\/chart\d+\.xml"[^>]*\/>/g,
      "",
    );
    const chartOverrides = charts
      .map(
        (_, index) =>
          `<Override PartName="/xl/charts/chart${index + 1}.xml" ` +
          'ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>',
      )
      .join("");
    return withoutCharts.replace(
      "</Types>",
      `${chartOverrides}<Override PartName="/xl/worksheets/sheet4.xml" ` +
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    );
  });

  // --- Dashboard ------------------------------------------------------------------------------
  edit(DASHBOARD, (xml) => {
    let worksheet = xml;
    worksheet = setCell(worksheet, "C2", summary.course.courseName);
    worksheet = setCell(worksheet, "H5", summary.course.courseName);
    worksheet = setCell(worksheet, "H6", thaiDateRange(summary.course.startAt, summary.course.endAt));
    worksheet = setCell(worksheet, "H7", summary.course.venue ?? "-");
    worksheet = setCell(worksheet, "H8", summary.course.instructor ?? "-");
    worksheet = setCell(worksheet, "B6", summary.submittedCount);
    worksheet = setCell(worksheet, "C6", summary.respondentsByCompany.length);

    // The written answers, previewed. Whole answers, not counts: this is the part of a report
    // nobody can get from a chart.
    const written = columns.filter((column) => column.kind === "TEXT");
    let row = PREVIEW_FIRST_ROW;
    for (const column of written) {
      const answers = people
        .map((person) => answerFor(person, column))
        .filter((answer): answer is string => typeof answer === "string" && answer.trim() !== "")
        .slice(0, PREVIEW_ANSWERS_PER_QUESTION);
      if (answers.length === 0) continue;
      if (row + answers.length > PREVIEW_LAST_ROW) break;
      worksheet = setCell(worksheet, `G${row}`, column.header, PREVIEW_QUESTION_STYLE);
      row += 1;
      for (const answer of answers) {
        worksheet = setCell(worksheet, `G${row}`, `• ${answer}`, PREVIEW_ANSWER_STYLE);
        row += 1;
      }
      row += 1;
    }
    return worksheet;
  });

  // --- Comments -------------------------------------------------------------------------------
  edit(COMMENTS, (xml) => {
    let worksheet = xml;
    const written = columns.filter((column) => column.kind === "TEXT");

    const headerCells = [
      cellXml(`A${COMMENT_HEADER_ROW}`, COMMENT_HEADER_STYLE, "ลำดับ"),
      ...written.map((column, index) =>
        cellXml(`${columnLetter(index + 2)}${COMMENT_HEADER_ROW}`, COMMENT_HEADER_STYLE, column.header),
      ),
    ].join("");

    const rows = people
      .map((person) => written.map((column) => answerFor(person, column)))
      .map((answers, index) => ({ answers, number: index + 1 }))
      .filter((entry) => entry.answers.some((answer) => typeof answer === "string" && answer.trim() !== ""))
      .map((entry, index) => {
        const row = COMMENT_FIRST_ROW + index;
        const cells = [
          cellXml(`A${row}`, COMMENT_NUMBER_STYLE, index + 1),
          ...entry.answers.map((answer, position) =>
            cellXml(`${columnLetter(position + 2)}${row}`, COMMENT_ANSWER_STYLE, answer),
          ),
        ].join("");
        return `<row r="${row}" spans="1:${written.length + 1}" ht="34.95" customHeight="1">${cells}</row>`;
      })
      .join("");

    worksheet = replaceRowsFrom(
      worksheet,
      COMMENT_HEADER_ROW,
      `<row r="${COMMENT_HEADER_ROW}" spans="1:${written.length + 1}" ht="57" customHeight="1">${headerCells}</row>${rows}`,
    );
    return worksheet.replace(
      /<dimension ref="[^"]+"\/>/,
      `<dimension ref="A1:${columnLetter(written.length + 1)}${COMMENT_FIRST_ROW + people.length}"/>`,
    );
  });

  return writeXlsxEntries(entries as XlsxEntry[]);
};
