import type { WorkflowCourse, WorkflowStandard } from "./trainingWorkflow";
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
) => {
  const wrapped = wrapText(value, width);
  if (wrapped.length > references.length) {
    wrapped[references.length - 1] = wrapped
      .slice(references.length - 1)
      .join(" ");
  }
  return references.reduce(
    (xml, reference, index) =>
      setXlsxInlineCell(xml, reference, wrapped[index] ?? ""),
    worksheetXml,
  );
};

const buildTargetGroup = (
  course: WorkflowCourse,
  standard: WorkflowStandard | null | undefined,
  language: "th" | "en",
) => {
  const labels =
    language === "th"
      ? { function: "หน่วยงาน", positions: "ตำแหน่ง", levels: "ระดับ" }
      : { function: "Function", positions: "Positions", levels: "Levels" };
  return [
    course.targetGroup,
    standard?.functionName
      ? `${labels.function}: ${standard.functionName}`
      : "",
    standard?.positions.length
      ? `${labels.positions}: ${standard.positions.join(", ")}`
      : "",
    standard?.levels.length
      ? `${labels.levels}: ${standard.levels.join(", ")}`
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
  standard: WorkflowStandard | null | undefined,
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
  xml = setXlsxInlineCell(xml, "K10", "-");
  xml = setTextBlock(
    xml,
    ["K14", "K15", "K16"],
    buildTargetGroup(course, standard, language),
    32,
  );
  xml = setTextBlock(
    xml,
    ["B19", "B20", "B21", "B22", "B23", "B24", "B25", "B26"],
    course.objective,
    65,
  );
  xml = setXlsxInlineCell(xml, "K19", isThai ? "วันที่ : -" : "Date: -");
  xml = setXlsxInlineCell(xml, "K20", isThai ? "เวลา : -" : "Time: -");
  xml = setXlsxInlineCell(xml, "K21", isThai ? "สถานที่ : -" : "Location: -");
  xml = setXlsxInlineCell(xml, "K25", "-");
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
  standard?: WorkflowStandard | null,
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
      fillOutlineSheet(worksheet.data.toString("utf8"), course, standard, language),
      "utf8",
    );
  }
  return writeXlsxEntries(entries);
};
