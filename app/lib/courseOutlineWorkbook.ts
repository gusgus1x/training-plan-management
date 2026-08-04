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

const wrapText = (value: string, width: number) => {
  const lines: string[] = [];
  for (const paragraph of (value.trim() || "-").split(/\r?\n/)) {
    let remaining = paragraph.trim();
    while (remaining.length > width) {
      const candidate = remaining.slice(0, width + 1);
      const spaceIndex = candidate.lastIndexOf(" ");
      const breakAt = spaceIndex > Math.floor(width / 2) ? spaceIndex : width;
      lines.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    lines.push(remaining || "-");
  }
  return lines;
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
    .replace(/\\s+ht=["'][^"']*["']/g, "")
    .replace(/\\s+customHeight=["'][^"']*["']/g, "");
  return worksheetXml.replace(
    match[0],
    `<row${attributes} ht="${height}" customHeight="1">`,
  );
};

const buildTargetGroup = (
  course: WorkflowCourse,
  oapPlan: WorkflowOapPlan | null | undefined,
  language: "th" | "en",
) => {
  return [
    course.targetGroup,
    oapPlan?.participants
      ? `${language === "th" ? "จำนวนผู้เข้าอบรม / รุ่น" : "Participants / group"}: ${oapPlan.participants}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
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

const fillOutlineSheet = (
  templateXml: string,
  course: WorkflowCourse,
  oapPlan: WorkflowOapPlan | null | undefined,
  language: "th" | "en",
) => {
  const isThai = language === "th";
  const title = isThai
    ? course.courseNameTh || course.courseNameEn
    : course.courseNameEn || course.courseNameTh;
  const background = [
    course.remark,
    isThai
      ? `ประเภทหลักสูตร: ${course.courseType}   กลุ่มหลักสูตร: ${course.courseGroup}`
      : `Course type: ${course.courseType}   Course group: ${course.courseGroup}`,
  ]
    .filter(Boolean)
    .join("\n");
  let xml = setXlsxInlineCell(
    templateXml,
    "B7",
    `${isThai ? "หลักสูตร" : "Course"} ${title} (${course.courseCode})`,
  );
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
    buildTargetGroup(course, oapPlan, language),
    52,
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
  xml = setXlsxInlineCell(xml, "K19", isThai ? "วันที่ : -" : "Date: -");
  xml = setXlsxInlineCell(
    xml,
    "K20",
    oapPlan?.hours
      ? `${isThai ? "ชั่วโมงอบรม" : "Training hours"}: ${oapPlan.hours}`
      : isThai
        ? "เวลา : -"
        : "Time: -",
  );
  xml = setXlsxInlineCell(xml, "K21", isThai ? "สถานที่ : -" : "Location: -");
  xml = setXlsxInlineCell(
    xml,
    "K25",
    oapPlan?.budget
      ? `${Number(oapPlan.budget).toLocaleString("en-US")} THB`
      : "-",
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
      ),
      "utf8",
    );
  }
  return writeXlsxEntries(entries);
};
