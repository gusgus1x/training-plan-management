import type {
  WorkflowCourse,
  WorkflowOapPlan,
  WorkflowStandard,
} from "./trainingWorkflow";
import {
  readXlsxEntries,
  setXlsxInlineCell,
  writeXlsxEntries,
} from "./xlsxTemplate";

// One source line stays on one row; only a line too wide for the page spills
// onto a second row, so a bullet is never fragmented across many rows.
const wrapText = (value: string, width: number = 60) => {
  const lines: string[] = [];
  for (const paragraph of (value.trim() || "-").split(/\r?\n/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= width + 15) {
      lines.push(trimmed);
      continue;
    }
    const spaceIndex = trimmed.slice(0, width + 1).lastIndexOf(" ");
    const cut = spaceIndex > Math.floor(width / 3) ? spaceIndex : width;
    lines.push(trimmed.slice(0, cut).trim(), trimmed.slice(cut).trim());
  }
  return lines.length > 0 ? lines : ["-"];
};

const setTextBlock = (
  worksheetXml: string,
  references: string[],
  value: string,
  width: number,
  options?: {
    overflowSeparator?: string;
    styleOverride?: string;
  },
) => {
  const wrapped = wrapText(value, width);
  // A course with more lines than the template has rows keeps every line: the
  // leftovers stack inside the last cell and that row grows to fit them.
  let overflowLines = 0;
  if (wrapped.length > references.length) {
    overflowLines = wrapped.length - references.length + 1;
    wrapped[references.length - 1] = wrapped
      .slice(references.length - 1)
      .join(options?.overflowSeparator ?? "\n");
  }
  const filled = references.reduce(
    (xml, reference, index) =>
      setXlsxInlineCell(
        xml,
        reference,
        wrapped[index] ?? "",
        options?.styleOverride,
      ),
    worksheetXml,
  );
  if (overflowLines < 2) return filled;
  const lastRow = Number(references[references.length - 1].replace(/\D+/g, ""));
  return setRowHeight(filled, lastRow, Math.max(15, overflowLines * 15));
};

const setRowHeight = (
  worksheetXml: string,
  rowNumber: number,
  height: number,
) => {
  const rowPattern = new RegExp(`<row\\b([^>]*\\br=["']${rowNumber}["'][^>]*)>`);
  const match = worksheetXml.match(rowPattern);
  if (!match) {
    throw new Error(`Invalid course outline template: row ${rowNumber} was not found.`);
  }
  const attributes = match[1]
    .replace(/\s+ht=["'][^"']*["']/g, "")
    .replace(/\s+customHeight=["'][^"']*["']/g, "");
  return worksheetXml.replace(
    match[0],
    `<row${attributes} ht="${height}" customHeight="1">`,
  );
};

const buildTargetGroup = (
  course: WorkflowCourse,
  standard: WorkflowStandard | null | undefined,
  language: "th" | "en",
) => {
  const isThai = language === "th";
  const freeText = (course.targetGroup || "").trim();
  if (!standard) return freeText || "-";

  const orgScope = [standard.functionName, standard.division, standard.department, standard.section]
    .filter(Boolean)
    .join(" / ");
  const lines = [
    [isThai ? "บริษัท" : "Companies", standard.companies?.join(", ")],
    [isThai ? "หน่วยงาน" : "Org", orgScope],
    [isThai ? "ตำแหน่ง" : "Positions", standard.positions.join(", ")],
    [isThai ? "ระดับ" : "Levels", standard.levels.join(", ")],
  ]
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value}`);

  if (freeText) lines.unshift(freeText);
  return lines.length > 0 ? lines.join("\n") : "-";
};

const buildEvaluation = (course: WorkflowCourse, language: "th" | "en") => {
  const labels =
    language === "th"
      ? {
          preTest: "แบบทดสอบก่อนอบรม",
          postTest: "แบบทดสอบหลังอบรม",
          followUp: "ติดตามผล 30 วัน",
        }
      : {
          preTest: "Pre-test",
          postTest: "Post-test",
          followUp: "30-day follow-up",
        };
  // Methodology and evaluation carry no label: the K31 section header already
  // reads "การประเมินผล" / "Training Evaluation".
  return [
    ["", course.methodology],
    [labels.preTest, course.preTest],
    [labels.postTest, course.postTest],
    ["", course.evaluation],
    [labels.followUp, course.evaluationAfter30Day],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => (label ? `${label}: ${value}` : value))
    .join("\n");
};

const formatNumberStr = (val: number | string | undefined | null) => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("en-US");
};

const buildBudgetContent = (
  budgetData?: { speakerFee?: number | string; foodFee?: number | string; totalBudget?: number | string } | null,
  oapPlan?: WorkflowOapPlan | null,
  language: "th" | "en" = "th",
) => {
  const isThai = language === "th";
  const unit = isThai ? "บาท" : "THB";

  const speakerFee = budgetData?.speakerFee;
  const foodFee = budgetData?.foodFee;
  const total = budgetData?.totalBudget ?? oapPlan?.budget;

  const speakerNum = speakerFee ? parseFloat(String(speakerFee).replace(/,/g, "")) : 0;
  const foodNum = foodFee ? parseFloat(String(foodFee).replace(/,/g, "")) : 0;

  if (speakerFee || foodFee) {
    const sStr = speakerFee ? `${formatNumberStr(speakerFee)} ${unit}` : `- ${unit}`;
    const fStr = foodFee ? `${formatNumberStr(foodFee)} ${unit}` : `- ${unit}`;
    const calcTotal = (speakerNum + foodNum) || (total ? parseFloat(String(total).replace(/,/g, "")) : 0);
    const totStr = calcTotal ? `${formatNumberStr(calcTotal)} ${unit}` : `- ${unit}`;

    if (isThai) {
      return [
        `1. ค่าวิทยากร      ${sStr}`,
        `2. อาหารและเบรก  ${fStr}`,
        `-----------------------------------`,
        `รวม/รุ่น           ${totStr}`,
      ].join("\n");
    }
    return [
      `1. Speaker Fee       ${sStr}`,
      `2. Food & Break      ${fStr}`,
      `-----------------------------------`,
      `Total/Batch          ${totStr}`,
    ].join("\n");
  }

  if (total) {
    const totStr = `${formatNumberStr(total)} ${unit}`;
    return isThai ? `รวม/รุ่น: ${totStr}` : `Total/Batch: ${totStr}`;
  }

  return "-";
};

const fillOutlineSheet = (
  templateXml: string,
  course: WorkflowCourse,
  standard: WorkflowStandard | null | undefined,
  oapPlan: WorkflowOapPlan | null | undefined,
  language: "th" | "en",
  scheduleData?: { date?: string; time?: string; location?: string } | null,
  budgetData?: { speakerFee?: number | string; foodFee?: number | string; totalBudget?: number | string } | null,
) => {
  const isThai = language === "th";
  const title = isThai
    ? course.courseNameTh || course.courseNameEn
    : course.courseNameEn || course.courseNameTh;

  // Background: Only if course.remark exists and is non-empty!
  const hasRemark = Boolean(course.remark && course.remark.trim() !== "" && course.remark.trim() !== "-");
  const background = hasRemark ? course.remark.trim() : "";

  // Determine row offset: if no background, shift up by 8 rows (B9‑B16)
  const rowOffset = hasRemark ? 0 : -8;

  let xml = setXlsxInlineCell(
    templateXml,
    "B7",
    `${isThai ? "หลักสูตร" : "Course"} ${title} (${course.courseCode})`,
  );

  // Conditional background header and rows
  if (hasRemark) {
    xml = setXlsxInlineCell(xml, "B9", isThai ? "ที่มา" : "Background");
    xml = setTextBlock(
      xml,
      ["B10", "B11", "B12", "B13", "B14", "B15", "B16"],
      background,
      65,
    );
  }

  xml = setXlsxInlineCell(
    xml,
    "K10",
    oapPlan
      ? [oapPlan.trainer, oapPlan.provider].filter(Boolean).join(" / ") || "-"
      : "-",
  );

  // Target group rows shift with offset
  xml = setTextBlock(
    xml,
    [
      `K${14 + rowOffset}`,
      `K${15 + rowOffset}`,
      `K${16 + rowOffset}`,
      `K${17 + rowOffset}`,
    ],
    buildTargetGroup(course, standard, language),
    50,
    { overflowSeparator: "\n", styleOverride: "48" },
  );
  const lastTargetCell = xml.match(
    new RegExp(`<c\\b[^>]*\\br=['\"]K${17 + rowOffset}['\"][^>]*>[\\s\\S]*?<t\\b[^>]*>([\\s\\S]*?)<\\/t>[\\s\\S]*?<\\/c>`),
  )?.[1] ?? "";
  const targetLineCount = Math.max(1, lastTargetCell.split("\n").length);
  xml = setRowHeight(xml, 17 + rowOffset, Math.max(15, targetLineCount * 15));
  xml = setTextBlock(
    xml,
    [
      `B${19 + rowOffset}`,
      `B${20 + rowOffset}`,
      `B${21 + rowOffset}`,
      `B${22 + rowOffset}`,
      `B${23 + rowOffset}`,
      `B${24 + rowOffset}`,
      `B${25 + rowOffset}`,
      `B${26 + rowOffset}`,
    ],
    course.objective,
    65,
  );

  const dateVal = scheduleData?.date || "";
  const timeVal = scheduleData?.time || (oapPlan?.hours ? `${oapPlan.hours} ${isThai ? "ชั่วโมง" : "hrs"}` : "");
  const locVal = scheduleData?.location || "";

  xml = setXlsxInlineCell(xml, `K${19 + rowOffset}`, `${isThai ? "วันที่ :" : "Date:"} ${dateVal || "-"}`);
  xml = setXlsxInlineCell(xml, `K${20 + rowOffset}`, `${isThai ? "เวลา :" : "Time:"} ${timeVal || "-"}`);
  xml = setXlsxInlineCell(xml, `K${21 + rowOffset}`, `${isThai ? "สถานที่ :" : "Location:"} ${locVal || "-"}`);

  xml = setTextBlock(
    xml,
    [
      `K${25 + rowOffset}`,
      `K${26 + rowOffset}`,
      `K${27 + rowOffset}`,
    ],
    buildBudgetContent(budgetData, oapPlan, language),
    40,
  );
  xml = setTextBlock(
    xml,
    [
      `B${29 + rowOffset}`,
      `B${30 + rowOffset}`,
      `B${31 + rowOffset}`,
      `B${32 + rowOffset}`,
      `B${33 + rowOffset}`,
      `B${34 + rowOffset}`,
      `B${35 + rowOffset}`,
      `B${36 + rowOffset}`,
      `B${37 + rowOffset}`,
      `B${38 + rowOffset}`,
    ],
    course.learningContent,
    65,
  );
  return setTextBlock(
    xml,
    [
      `K${32 + rowOffset}`,
      `K${33 + rowOffset}`,
      `K${34 + rowOffset}`,
      `K${35 + rowOffset}`,
      `K${36 + rowOffset}`,
      `K${37 + rowOffset}`,
      `K${38 + rowOffset}`,
    ],
    buildEvaluation(course, language),
    32,
  );
};

export const buildCourseOutlineWorkbook = (
  template: Buffer,
  course: WorkflowCourse,
  standard?: WorkflowStandard | null,
  oapPlan?: WorkflowOapPlan | null,
  schedule?: { date?: string; time?: string; location?: string } | null,
  budget?: { speakerFee?: number | string; foodFee?: number | string; totalBudget?: number | string } | null,
) => {
  const entries = readXlsxEntries(template);
  for (const [sheetNumber, language] of [
    [1, "th"],
    [2, "en"],
  ] as const) {
    const worksheet = entries.find(
      (entry) => entry.name === `xl/worksheets/sheet${sheetNumber}.xml`,
    );
    if (!worksheet) {
      throw new Error(`Invalid course outline template: sheet${sheetNumber} was not found.`);
    }
    worksheet.data = Buffer.from(
      fillOutlineSheet(
        worksheet.data.toString("utf8"),
        course,
        standard,
        oapPlan,
        language,
        schedule,
        budget,
      ),
      "utf8",
    );
  }
  return writeXlsxEntries(entries);
};
