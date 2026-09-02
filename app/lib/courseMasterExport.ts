import {
  escapeXlsxXml,
  readXlsxEntries,
  writeXlsxEntries,
  type XlsxEntry,
} from "./xlsxTemplate";

const LEVEL_COLS: Record<string, string> = {
  O1: "N",
  O2: "O",
  O3: "P",
  O4: "Q",
  O5: "R",
  S1: "S",
  S2: "T",
  S3: "U",
  S4: "V",
  M1: "W",
  M2: "X",
  M3: "Y",
};

const ALL_LEVEL_KEYS = ["O1", "O2", "O3", "O4", "O5", "S1", "S2", "S3", "S4", "M1", "M2", "M3"];

export type CourseExportRecord = {
  courseCode: string;
  courseNameTh: string;
  courseNameEn?: string;
  courseGroup?: string;
  courseType?: string;
  objective?: string;
  learningContent?: string;
  targetGroup?: string;
  methodology?: string;
  instructor?: string;
  levels?: string[];
  positions?: string[];
};

const inlineCell = (ref: string, styleId: string, val: string) => {
  if (!val) {
    return `<c r="${ref}" s="${styleId}"/>`;
  }
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXlsxXml(val)}</t></is></c>`;
};

export const buildCourseMasterExportWorkbook = (
  templateBuffer: Buffer,
  courses: CourseExportRecord[],
): Buffer => {
  const entries = readXlsxEntries(templateBuffer);
  const worksheetEntry = entries.find(
    (item) => item.name === "xl/worksheets/sheet1.xml",
  );

  if (!worksheetEntry) {
    throw new Error("Invalid Excel template: sheet1.xml was not found.");
  }

  let sheetXml = worksheetEntry.data.toString("utf8");

  // Keep header rows 1 to 6
  const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetDataMatch) {
    throw new Error("Invalid Excel template: sheetData was not found.");
  }

  const existingRows = sheetDataMatch[1].match(/<row\b[\s\S]*?<\/row>/g) || [];
  const headerRows = existingRows.filter((rowXml) => {
    const rMatch = rowXml.match(/r="(\d+)"/);
    if (!rMatch) return false;
    const rNum = parseInt(rMatch[1], 10);
    return rNum >= 1 && rNum <= 6;
  });

  const dataRows: string[] = [];

  courses.forEach((course, index) => {
    const rNum = index + 7;
    const activeLevels = new Set(
      (course.levels || []).map((lvl) => lvl.trim().toUpperCase()),
    );

    const cells: string[] = [
      inlineCell(`A${rNum}`, "16", String(index + 1)),
      inlineCell(`B${rNum}`, "17", course.courseCode || ""),
      inlineCell(`C${rNum}`, "17", course.courseGroup || "General"),
      inlineCell(`D${rNum}`, "18", course.instructor || "-"),
      `<c r="E${rNum}" s="18"/>`,
      `<c r="F${rNum}" s="17"/>`,
      `<c r="G${rNum}" s="17"/>`,
      `<c r="H${rNum}" s="17"/>`,
      `<c r="I${rNum}" s="17"/>`,
      `<c r="J${rNum}" s="17"/>`,
      inlineCell(`K${rNum}`, "19", course.courseNameTh || course.courseNameEn || ""),
      `<c r="L${rNum}" s="17"/>`,
      inlineCell(`M${rNum}`, "20", course.targetGroup || "-"),
    ];

    // Levels N to Y (tick checkmark)
    ALL_LEVEL_KEYS.forEach((lvlKey) => {
      const col = LEVEL_COLS[lvlKey];
      const isChecked = activeLevels.has(lvlKey);
      cells.push(inlineCell(`${col}${rNum}`, "21", isChecked ? "✓" : ""));
    });

    // Learning Content (Z), Objective (AA)
    cells.push(inlineCell(`Z${rNum}`, "20", course.learningContent || "-"));
    cells.push(inlineCell(`AA${rNum}`, "20", course.objective || "-"));

    // Blank columns AB to BA
    const middleBlankCols = [
      "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN",
      "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA",
    ];
    middleBlankCols.forEach((col) => {
      cells.push(`<c r="${col}${rNum}" s="17"/>`);
    });

    // Column BB left empty per user requirement
    cells.push(`<c r="BB${rNum}" s="25"/>`);
    cells.push(`<c r="BC${rNum}" s="26"/>`);
    cells.push(`<c r="BD${rNum}" s="78"/>`);
    cells.push(`<c r="BE${rNum}" s="78"/>`);
    cells.push(`<c r="BF${rNum}" s="79"/>`);
    cells.push(`<c r="BG${rNum}" s="79"/>`);
    cells.push(`<c r="BH${rNum}" s="79"/>`);
    cells.push(`<c r="BI${rNum}" s="79"/>`);
    cells.push(`<c r="BJ${rNum}" s="79"/>`);
    cells.push(`<c r="BK${rNum}" s="80"/>`);
    cells.push(`<c r="BL${rNum}" s="79"/>`);
    cells.push(`<c r="BM${rNum}" s="81"/>`);
    cells.push(`<c r="BN${rNum}" s="81"/>`);
    cells.push(`<c r="BO${rNum}" s="81"/>`);
    cells.push(`<c r="BP${rNum}" s="81"/>`);
    cells.push(`<c r="BQ${rNum}" s="82"/>`);
    cells.push(`<c r="BR${rNum}" s="82"/>`);
    cells.push(`<c r="BS${rNum}" s="27"/>`);
    cells.push(inlineCell(`BU${rNum}`, "17", course.courseType || "ATA-TC"));

    const rowXml = `<row r="${rNum}" spans="1:73" s="28" customFormat="1" ht="47.1" customHeight="1" x14ac:dyDescent="0.3">${cells.join("")}</row>`;
    dataRows.push(rowXml);
  });

  const newSheetData = `<sheetData>${headerRows.join("")}${dataRows.join("")}</sheetData>`;
  sheetXml = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, newSheetData);

  // Update dimension
  const maxRow = Math.max(6, courses.length + 6);
  sheetXml = sheetXml.replace(
    /<dimension ref="[^"]*"/,
    `<dimension ref="A1:BU${maxRow}"`,
  );

  worksheetEntry.data = Buffer.from(sheetXml, "utf8");

  return writeXlsxEntries(entries);
};

export const buildCompanyCourseMasterExportZip = (
  templateBuffer: Buffer,
  companyCoursesMap: Map<string, CourseExportRecord[]>,
  dateStr: string,
): Buffer => {
  const zipEntries: XlsxEntry[] = [];

  for (const [companyCode, records] of companyCoursesMap.entries()) {
    if (!records || records.length === 0) continue;
    const excelBuffer = buildCourseMasterExportWorkbook(templateBuffer, records);
    const fileName = `Master_Course_${companyCode}_${dateStr}.xlsx`;
    zipEntries.push({
      name: fileName,
      data: excelBuffer,
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    });
  }

  return writeXlsxEntries(zipEntries);
};

