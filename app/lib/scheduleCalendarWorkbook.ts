import { columnLetter, escapeXlsxXml as escapeXml, writeXlsxEntries, type XlsxEntry } from "./xlsxTemplate";

/**
 * Schedule Calendar -> a month-per-sheet .xlsx that looks like a printed wall calendar, plus a
 * last "รายการ" sheet with the flat list the old export produced.
 *
 * The page lays the month out (buildCalendarWeeks in ScheduleCalendar.tsx) and sends the result,
 * so the bars land in the same week rows and slots as on screen. This file only draws them.
 * Built from scratch rather than from a template: the number of weeks, bar rows and merges
 * changes every month.
 */

export const CALENDAR_COMPANY_KEYS = ["ALL", "ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;
export type CalendarExportCompanyKey = (typeof CALENDAR_COMPANY_KEYS)[number];

export type CalendarExportSegment = {
  /** 0 = Sunday */
  startCol: number;
  span: number;
  slot: number;
  courseName: string;
  companyKey: CalendarExportCompanyKey;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
};

export type CalendarExportWeek = {
  days: { dayNumber: number; isCurrentMonth: boolean }[];
  segments: CalendarExportSegment[];
};

export type CalendarExportMonth = { month: number; weeks: CalendarExportWeek[] };

export type CalendarExportRow = {
  month: string;
  date: string;
  courseCode: string;
  courseName: string;
  time: string;
  company: string;
};

export type CalendarExportInput = {
  year: number;
  months: CalendarExportMonth[];
  rows: CalendarExportRow[];
};

// --- Input check (the route's trust boundary) ------------------------------------------------

const MAX_TEXT = 300;

const fail = (message: string): never => {
  throw new Error(message);
};
const asObject = (value: unknown, what: string) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : fail(`${what} is invalid`);
const asArray = (value: unknown, what: string, max: number) =>
  Array.isArray(value) && value.length <= max ? value : fail(`${what} is invalid`);
const asInt = (value: unknown, what: string, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fail(`${what} is invalid`);
const asText = (value: unknown) => String(value ?? "").slice(0, MAX_TEXT);

export const parseCalendarExportInput = (body: unknown): CalendarExportInput => {
  const input = asObject(body, "body");
  return {
    year: asInt(input.year, "year", 2000, 2200),
    months: asArray(input.months, "months", 12).map((rawMonth) => {
      const month = asObject(rawMonth, "month");
      return {
        month: asInt(month.month, "month", 1, 12),
        weeks: asArray(month.weeks, "weeks", 6).map((rawWeek) => {
          const week = asObject(rawWeek, "week");
          const days = asArray(week.days, "days", 7).map((rawDay) => {
            const day = asObject(rawDay, "day");
            return { dayNumber: asInt(day.dayNumber, "dayNumber", 1, 31), isCurrentMonth: day.isCurrentMonth === true };
          });
          if (days.length !== 7) fail("days is invalid");
          return {
            days,
            segments: asArray(week.segments, "segments", 500).map((rawSegment) => {
              const segment = asObject(rawSegment, "segment");
              const startCol = asInt(segment.startCol, "startCol", 0, 6);
              const companyKey = CALENDAR_COMPANY_KEYS.includes(segment.companyKey as CalendarExportCompanyKey)
                ? (segment.companyKey as CalendarExportCompanyKey)
                : "ALL";
              return {
                startCol,
                span: asInt(segment.span, "span", 1, 7 - startCol),
                slot: asInt(segment.slot, "slot", 0, 99),
                courseName: asText(segment.courseName),
                companyKey,
                continuesFromPrev: segment.continuesFromPrev === true,
                continuesToNext: segment.continuesToNext === true,
              };
            }),
          };
        }),
      };
    }),
    rows: asArray(input.rows, "rows", 5000).map((rawRow) => {
      const row = asObject(rawRow, "row");
      return {
        month: asText(row.month),
        date: asText(row.date),
        courseCode: asText(row.courseCode),
        courseName: asText(row.courseName),
        time: asText(row.time),
        company: asText(row.company),
      };
    }),
  };
};

// --- Look ------------------------------------------------------------------------------------

const FONT = "Leelawadee UI";
const BROWN = "6B3E2E";
const PINK = "F06CA8";
const SKY = "BFE3FA";
const WEEKEND_FILL = "D6E6FB";
const WEEKDAY_FILL = "F5F9FE";
const OTHER_MONTH_FILL = "E9EEF5";

// Same colours as .eventCard_* in ScheduleCalendar.module.css: [fill, text/border].
const COMPANY_COLORS: Record<CalendarExportCompanyKey, [string, string]> = {
  ALL: ["A7F3D0", "047857"],
  ATA: ["BFDBFE", "1D4ED8"],
  ATFB: ["FED7AA", "C2410C"],
  NIC: ["E9D5FF", "7E22CE"],
  SATI: ["FECACA", "B91C1C"],
  SNF: ["A5F3FC", "0E7490"],
  TEP: ["FDE68A", "A16207"],
};
const COMPANY_LABEL: Record<CalendarExportCompanyKey, string> = {
  ALL: "ทุกบริษัท",
  ATA: "ATA",
  ATFB: "ATFB",
  NIC: "NIC",
  SATI: "SATI",
  SNF: "SNF",
  TEP: "TEP",
};

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const ENGLISH_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

// --- Styles: one registry so every fill/font/border combination becomes a single cellXfs entry --

type Edge = "thin" | "medium" | undefined;
type StyleSpec = {
  font?: { size?: number; bold?: boolean; color?: string };
  fill?: string;
  border?: { left?: Edge; right?: Edge; top?: Edge; bottom?: Edge; color?: string };
  horizontal?: "left" | "center";
  vertical?: "top" | "center";
  wrap?: boolean;
  indent?: number;
};

const createStyles = () => {
  const fonts: string[] = [`<font><sz val="11"/><name val="${FONT}"/></font>`];
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders: string[] = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  const xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const index = (list: string[], xml: string) => {
    const found = list.indexOf(xml);
    if (found !== -1) return found;
    list.push(xml);
    return list.length - 1;
  };

  const style = (spec: StyleSpec) => {
    const font = spec.font ?? {};
    const fontId = index(
      fonts,
      `<font>${font.bold ? "<b/>" : ""}<sz val="${font.size ?? 11}"/><color rgb="FF${font.color ?? BROWN}"/><name val="${FONT}"/></font>`,
    );
    const fillId = spec.fill
      ? index(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${spec.fill}"/><bgColor indexed="64"/></patternFill></fill>`)
      : 0;
    const border = spec.border ?? {};
    const edge = (side: "left" | "right" | "top" | "bottom") =>
      border[side] ? `<${side} style="${border[side]}"><color rgb="FF${border.color ?? BROWN}"/></${side}>` : `<${side}/>`;
    const borderId = index(borders, `<border>${edge("left")}${edge("right")}${edge("top")}${edge("bottom")}<diagonal/></border>`);
    const alignment = `<alignment horizontal="${spec.horizontal ?? "center"}" vertical="${spec.vertical ?? "center"}"${spec.wrap ? ' wrapText="1"' : ""}${spec.indent ? ` indent="${spec.indent}"` : ""}/>`;
    return String(
      index(
        xfs,
        `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${alignment}</xf>`,
      ),
    );
  };

  const xml = () =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    `<borders count="${borders.length}">${borders.join("")}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  return { style, xml };
};

type Styles = ReturnType<typeof createStyles>;

// --- Worksheet -------------------------------------------------------------------------------

type Cell = { style: string; value?: string | number; rich?: string };
type SheetRow = { height?: number; cells: Map<number, Cell> };

class SheetBuilder {
  private rows = new Map<number, SheetRow>();
  private merges: string[] = [];

  set(row: number, column: number, cell: Cell) {
    const entry: SheetRow = this.rows.get(row) ?? { cells: new Map() };
    entry.cells.set(column, cell);
    this.rows.set(row, entry);
  }

  height(row: number, height: number) {
    const entry: SheetRow = this.rows.get(row) ?? { cells: new Map() };
    entry.height = height;
    this.rows.set(row, entry);
  }

  /** Styles every cell of the range (so borders and fill cover it all) and merges it. */
  merge(row: number, firstColumn: number, lastColumn: number, cell: Cell) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      this.set(row, column, column === firstColumn ? cell : { style: cell.style });
    }
    if (lastColumn > firstColumn) this.merges.push(`${columnLetter(firstColumn)}${row}:${columnLetter(lastColumn)}${row}`);
  }

  xml({ columns, landscape }: { columns: { width: number }[]; landscape: boolean }) {
    const cellXml = (reference: string, cell: Cell) => {
      const attributes = `r="${reference}" s="${cell.style}"`;
      if (cell.rich) return `<c ${attributes} t="inlineStr"><is>${cell.rich}</is></c>`;
      if (cell.value === undefined || cell.value === "") return `<c ${attributes}/>`;
      if (typeof cell.value === "number") return `<c ${attributes}><v>${cell.value}</v></c>`;
      return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
    };
    const rows = [...this.rows.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, { height, cells }]) => {
        const body = [...cells.entries()]
          .sort(([a], [b]) => a - b)
          .map(([column, cell]) => cellXml(`${columnLetter(column)}${row}`, cell))
          .join("");
        return `<row r="${row}"${height ? ` ht="${height}" customHeight="1"` : ""}>${body}</row>`;
      })
      .join("");
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
      `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<cols>${columns.map((column, i) => `<col min="${i + 1}" max="${i + 1}" width="${column.width}" customWidth="1"/>`).join("")}</cols>` +
      `<sheetData>${rows}</sheetData>` +
      (this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "") +
      `<printOptions horizontalCentered="1"/>` +
      `<pageMargins left="0.3" right="0.3" top="0.3" bottom="0.3" header="0.1" footer="0.1"/>` +
      `<pageSetup paperSize="9" orientation="${landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="${landscape ? 1 : 0}"/>` +
      `</worksheet>`
    );
  }
}

// Columns: A and I are narrow gutters, B..H are Sunday..Saturday.
const FIRST_DAY_COLUMN = 2;
const MIN_BAR_ROWS = 2;
// Bold 9pt characters that fit on one line of a 24-wide day column.
const CHARS_PER_DAY_COLUMN = 30;

const titleRun = (text: string, color: string) =>
  `<r><rPr><rFont val="${FONT}"/><b/><sz val="30"/><color rgb="FF${color}"/></rPr><t xml:space="preserve">${escapeXml(text)}</t></r>`;

const buildMonthSheet = (styles: Styles, year: number, { month, weeks }: CalendarExportMonth) => {
  const sheet = new SheetBuilder();
  const lastDayColumn = FIRST_DAY_COLUMN + 6;
  const sky = styles.style({ fill: SKY });

  // Title band
  for (const row of [1, 2, 3]) {
    for (let column = 1; column <= lastDayColumn + 1; column += 1) sheet.set(row, column, { style: sky });
  }
  sheet.height(1, 10);
  sheet.height(2, 52);
  sheet.height(3, 10);
  sheet.merge(2, FIRST_DAY_COLUMN, lastDayColumn, {
    style: sky,
    rich:
      titleRun(`${THAI_MONTHS[month - 1]}   `, PINK) +
      titleRun(`${ENGLISH_MONTHS[month - 1]}   `, BROWN) +
      titleRun(String(year), "E08A00"),
  });

  // Weekday header
  sheet.height(4, 30);
  THAI_WEEKDAYS.forEach((name, index) => {
    const weekend = index === 0 || index === 6;
    sheet.set(4, FIRST_DAY_COLUMN + index, {
      value: name,
      style: styles.style({
        font: { size: 14, bold: true, color: weekend ? "FFFFFF" : BROWN },
        fill: weekend ? PINK : "FFFFFF",
        border: { left: "medium", right: "medium", top: "medium", bottom: "medium" },
      }),
    });
  });

  // Weeks: one day-number row, then one row per bar slot
  let row = 5;
  for (const week of weeks) {
    const barRows = Math.max(MIN_BAR_ROWS, ...week.segments.map((segment) => segment.slot + 1));
    const lastRow = row + barRows;
    sheet.height(row, 24);
    // ponytail: line count is estimated from characters per column width (Excel has no autofit
    // for merged cells); measure glyph widths if long Thai names still clip.
    for (let slot = 0; slot < barRows; slot += 1) {
      const lines = Math.max(
        2,
        ...week.segments
          .filter((segment) => segment.slot === slot)
          .map((segment) => Math.ceil((segment.courseName.length + 8) / (CHARS_PER_DAY_COLUMN * segment.span))),
      );
      sheet.height(row + 1 + slot, lines * 13 + 6);
    }

    week.days.forEach((day, index) => {
      const column = FIRST_DAY_COLUMN + index;
      const fill = !day.isCurrentMonth ? OTHER_MONTH_FILL : index === 0 || index === 6 ? WEEKEND_FILL : WEEKDAY_FILL;
      for (let cellRow = row; cellRow <= lastRow; cellRow += 1) {
        sheet.set(cellRow, column, {
          value: cellRow === row && day.isCurrentMonth ? day.dayNumber : undefined,
          style: styles.style({
            font: cellRow === row ? { size: 14, color: BROWN } : undefined,
            fill,
            border: { left: "medium", right: "medium", top: cellRow === row ? "medium" : undefined, bottom: cellRow === lastRow ? "medium" : undefined },
            horizontal: "left",
            vertical: "top",
            indent: 1,
          }),
        });
      }
    });

    for (const segment of week.segments) {
      const [fill, color] = COMPANY_COLORS[segment.companyKey];
      const label = [
        segment.continuesFromPrev ? "◀ " : "",
        segment.courseName,
        segment.companyKey === "ALL" ? "" : `  ${segment.companyKey}`,
        segment.continuesToNext ? " ▶" : "",
      ].join("");
      const firstColumn = FIRST_DAY_COLUMN + segment.startCol;
      sheet.merge(row + 1 + segment.slot, firstColumn, firstColumn + segment.span - 1, {
        value: label,
        style: styles.style({
          font: { size: 9, bold: true, color },
          fill,
          border: { left: "thin", right: "thin", top: "thin", bottom: "thin", color },
          wrap: true,
        }),
      });
    }
    row = lastRow + 1;
  }

  // Colour legend
  row += 1;
  sheet.height(row, 22);
  CALENDAR_COMPANY_KEYS.forEach((key, index) => {
    const [fill, color] = COMPANY_COLORS[key];
    sheet.set(row, FIRST_DAY_COLUMN + index, {
      value: COMPANY_LABEL[key],
      style: styles.style({
        font: { size: 10, bold: true, color },
        fill,
        border: { left: "thin", right: "thin", top: "thin", bottom: "thin", color },
      }),
    });
  });

  return sheet.xml({
    columns: [{ width: 2 }, ...Array.from({ length: 7 }, () => ({ width: 24 })), { width: 2 }],
    landscape: true,
  });
};

const LIST_HEADERS = ["เดือน", "วันที่", "รหัสหลักสูตร", "ชื่อหลักสูตร", "เวลา", "บริษัท"];

const buildListSheet = (styles: Styles, rows: CalendarExportRow[]) => {
  const sheet = new SheetBuilder();
  const border = { left: "thin", right: "thin", top: "thin", bottom: "thin" } as const;
  const header = styles.style({ font: { bold: true, color: "FFFFFF" }, fill: PINK, border });
  const body = styles.style({ border, horizontal: "left", vertical: "center", wrap: true });
  LIST_HEADERS.forEach((title, index) => sheet.set(1, index + 1, { value: title, style: header }));
  rows.forEach((item, index) => {
    [item.month, item.date, item.courseCode, item.courseName, item.time, item.company].forEach((value, column) =>
      sheet.set(index + 2, column + 1, { value, style: body }),
    );
  });
  return sheet.xml({
    columns: [{ width: 14 }, { width: 26 }, { width: 22 }, { width: 50 }, { width: 14 }, { width: 18 }],
    landscape: false,
  });
};

// --- Package ---------------------------------------------------------------------------------

// DOS date 1980-01-01; the archive has no meaningful timestamps.
const entry = (name: string, xml: string): XlsxEntry => ({
  name,
  data: Buffer.from(xml, "utf8"),
  compressionMethod: 8,
  modifiedTime: 0,
  modifiedDate: 33,
  externalAttributes: 0,
});

export const buildScheduleCalendarWorkbook = (input: CalendarExportInput) => {
  const styles = createStyles();
  const sheets = [
    ...input.months.map((month) => ({
      name: `${String(month.month).padStart(2, "0")} ${THAI_MONTHS[month.month - 1]}`,
      xml: buildMonthSheet(styles, input.year, month),
    })),
    { name: "รายการ", xml: buildListSheet(styles, input.rows) },
  ];

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<bookViews><workbookView/></bookViews>` +
    `<sheets>${sheets.map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
    `</workbook>`;
  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("") +
    `</Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  return writeXlsxEntries([
    entry("[Content_Types].xml", contentTypes),
    entry("_rels/.rels", rootRels),
    entry("xl/workbook.xml", workbook),
    entry("xl/_rels/workbook.xml.rels", workbookRels),
    // Styles are only complete once every sheet has been drawn.
    ...sheets.map((sheet, i) => entry(`xl/worksheets/sheet${i + 1}.xml`, sheet.xml)),
    entry("xl/styles.xml", styles.xml()),
  ]);
};
