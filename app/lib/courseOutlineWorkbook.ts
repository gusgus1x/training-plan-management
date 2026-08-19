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

const wrapText = (value: string, width: number = 60) => {
  const lines: string[] = [];
  for (const paragraph of (value.trim() || "-").split(/\r?\n/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= width + 15) {
      lines.push(trimmed);
      continue;
    }
    let remaining = trimmed;
    while (remaining.length > width) {
      const candidate = remaining.slice(0, width + 1);
      const spaceIndex = candidate.lastIndexOf(" ");
      if (spaceIndex > Math.floor(width / 3)) {
        lines.push(remaining.slice(0, spaceIndex).trim());
        remaining = remaining.slice(spaceIndex).trim();
      } else {
        if (remaining.length <= width + 15) {
          break;
        }
        lines.push(remaining.slice(0, width).trim());
        remaining = remaining.slice(width).trim();
      }
    }
    if (remaining) {
      lines.push(remaining);
    }
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
  if (wrapped.length > references.length) {
    wrapped[references.length - 1] = wrapped
      .slice(references.length - 1)
      .join(options?.overflowSeparator ?? " ");
  }
  return references.reduce(
    (xml, reference, index) =>
      setXlsxInlineCell(
        xml,
        reference,
        wrapped[index] ?? "",
        options?.styleOverride,
      ),
    worksheetXml,
  );
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
) => {
  return (course.targetGroup || "-").trim();
};

const buildEvaluation = (course: WorkflowCourse, language: "th" | "en") => {
  const labels =
    language === "th"
      ? {
          methodology: "วิธีการอบรม",
          preTest: "แบบทดสอบก่อนอบรม",
          postTest: "แบบทดสอบหลังอบรม",
          evaluation: "การประเมินผล",
          followUp: "ติดตามผล 30 วัน",
        }
      : {
          methodology: "Methodology",
          preTest: "Pre-test",
          postTest: "Post-test",
          evaluation: "Evaluation",
          followUp: "30-day follow-up",
        };
  return [
    [labels.methodology, course.methodology],
    [labels.preTest, course.preTest],
    [labels.postTest, course.postTest],
    [labels.evaluation, course.evaluation],
    [labels.followUp, course.evaluationAfter30Day],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value}`)
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

  let xml = setXlsxInlineCell(
    templateXml,
    "B7",
    `${isThai ? "หลักสูตร" : "Course"} ${title} (${course.courseCode})`,
  );

  // Cell B9 is the "ที่มา" / "Background" header (Cell C9 is merged with B9)
  xml = setXlsxInlineCell(xml, "B9", hasRemark ? (isThai ? "ที่มา" : "Background") : "");

  xml = setTextBlock(
    xml,
    ["B10", "B11", "B12", "B13", "B14", "B15", "B16"],
    background,
    65,
  );
  xml = setXlsxInlineCell(
    xml,
    "K10",
    oapPlan
      ? [oapPlan.trainer, oapPlan.provider].filter(Boolean).join(" / ") || "-"
      : "-",
  );
  xml = setTextBlock(
    xml,
    ["K14", "K15", "K16", "K17"],
    buildTargetGroup(course),
    50,
    { overflowSeparator: "\n", styleOverride: "48" },
  );
  const lastTargetCell = xml.match(
    /<c\b[^>]*\br=["']K17["'][^>]*>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/c>/,
  )?.[1] ?? "";
  const targetLineCount = Math.max(1, lastTargetCell.split("\n").length);
  xml = setRowHeight(xml, 17, Math.max(15, targetLineCount * 15));
  xml = setTextBlock(
    xml,
    ["B19", "B20", "B21", "B22", "B23", "B24", "B25", "B26"],
    course.objective,
    65,
  );

  const dateVal = scheduleData?.date || "";
  const timeVal = scheduleData?.time || (oapPlan?.hours ? `${oapPlan.hours} ${isThai ? "ชั่วโมง" : "hrs"}` : "");
  const locVal = scheduleData?.location || "";

  xml = setXlsxInlineCell(xml, "K19", `${isThai ? "วันที่ :" : "Date:"} ${dateVal || "-"}`);
  xml = setXlsxInlineCell(xml, "K20", `${isThai ? "เวลา :" : "Time:"} ${timeVal || "-"}`);
  xml = setXlsxInlineCell(xml, "K21", `${isThai ? "สถานที่ :" : "Location:"} ${locVal || "-"}`);

  xml = setTextBlock(
    xml,
    ["K25", "K26", "K27"],
    buildBudgetContent(budgetData, oapPlan, language),
    40,
  );
  xml = setTextBlock(
    xml,
    ["B29", "B30", "B31", "B32", "B33", "B34", "B35", "B36", "B37", "B38"],
    course.learningContent,
    65,
  );
  return setTextBlock(
    xml,
    ["K32", "K33", "K34", "K35", "K36", "K37", "K38"],
    buildEvaluation(course, language),
    32,
  );
};

export const buildCourseOutlineWorkbook = (
  template: Buffer,
  course: WorkflowCourse,
  _standard?: WorkflowStandard | null,
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
