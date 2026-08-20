import type {
  WorkflowCourse,
  WorkflowOapPlan,
  WorkflowStandard,
} from "./trainingWorkflow";
import {
  escapeXlsxXml,
  readXlsxEntries,
  setXlsxInlineCell,
  writeXlsxEntries,
} from "./xlsxTemplate";

const formatNumberStr = (val: number | string | undefined | null) => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("en-US");
};

type BudgetData = {
  budgetInstructor?: number | string;
  budgetTraveling?: number | string;
  budgetSeminarRoom?: number | string;
  budgetAccommodation?: number | string;
  budgetMaterial?: number | string;
  budgetFoodBeverage?: number | string;
  totalBudget?: number | string;
};

const BUDGET_CATEGORIES: Array<{ key: keyof BudgetData; th: string; en: string }> = [
  { key: "budgetInstructor", th: "ค่าวิทยากร", en: "Instructor Fee" },
  { key: "budgetTraveling", th: "ค่าเดินทาง", en: "Traveling" },
  { key: "budgetSeminarRoom", th: "ค่าห้องสัมมนา", en: "Seminar Room" },
  { key: "budgetAccommodation", th: "ค่าที่พัก", en: "Accommodation" },
  { key: "budgetMaterial", th: "ค่าวัสดุ/เอกสาร", en: "Material" },
  { key: "budgetFoodBeverage", th: "อาหารและเบรก", en: "Food & Beverage" },
];

const toNumber = (value: number | string | undefined | null) => {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

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
  let overflowLines = 0;
  if (wrapped.length > references.length) {
    overflowLines = wrapped.length - references.length + 1;
    wrapped[references.length - 1] = wrapped
      .slice(references.length - 1)
      .join(options?.overflowSeparator ?? "\n");
  }
  return references.reduce(
    (xml, reference, index) => {
      if (new RegExp(`<c\\b[^>]*\\br=['"]${reference}['"]`).test(xml)) {
        return setXlsxInlineCell(
          xml,
          reference,
          wrapped[index] ?? "",
          options?.styleOverride,
        );
      }
      return xml;
    },
    worksheetXml,
  );
};

const buildTargetGroup = (
  course: WorkflowCourse,
  _standard?: WorkflowStandard | null,
  _language?: "th" | "en",
) => {
  return (course.targetGroup || "").trim() || "-";
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
  return [
    ["", course.methodology],
    [labels.preTest, course.preTest],
    [labels.postTest, course.postTest],
    ["", course.evaluation],
    [labels.followUp, course.evaluationAfter30Day],
  ]
    .filter(([, value]) => Boolean(value && value.trim()))
    .map(([label, value]) => (label ? `${label}: ${value!.trim()}` : value!.trim()))
    .join("\n");
};

const fillBudgetMultiColumn = (
  worksheetXml: string,
  budgetData?: BudgetData | null,
  oapPlan?: WorkflowOapPlan | null,
  language: "th" | "en" = "th",
) => {
  const isThai = language === "th";
  const unit = isThai ? "บาท" : "THB";

  const items = BUDGET_CATEGORIES.map((category) => ({
    label: isThai ? category.th : category.en,
    amount: toNumber(budgetData?.[category.key]),
  })).filter((item) => item.amount > 0);

  const total = items.length > 0
    ? items.reduce((sum, item) => sum + item.amount, 0)
    : toNumber(budgetData?.totalBudget ?? oapPlan?.budget);

  let xml = worksheetXml;

  if (items.length > 0) {
    items.forEach((item, index) => {
      const row = 25 + index;
      if (row <= 30) {
        if (new RegExp(`<c\\b[^>]*\\br=['"]K${row}['"]`).test(xml)) {
          xml = setXlsxInlineCell(xml, `K${row}`, `${index + 1}. ${item.label}`);
        }
        if (new RegExp(`<c\\b[^>]*\\br=['"]L${row}['"]`).test(xml)) {
          xml = setXlsxInlineCell(xml, `L${row}`, "");
        }
        if (new RegExp(`<c\\b[^>]*\\br=['"]M${row}['"]`).test(xml)) {
          xml = setXlsxInlineCell(xml, `M${row}`, formatNumberStr(item.amount));
        }
        if (new RegExp(`<c\\b[^>]*\\br=['"]N${row}['"]`).test(xml)) {
          xml = setXlsxInlineCell(xml, `N${row}`, unit);
        }
      }
    });

    const totalRow = 25 + Math.min(items.length, 6);
    const totalLabel = isThai ? "รวม/รุ่น" : "Total/Batch";
    if (new RegExp(`<c\\b[^>]*\\br=['"]K${totalRow}['"]`).test(xml)) {
      xml = setXlsxInlineCell(xml, `K${totalRow}`, totalLabel);
    }
    if (new RegExp(`<c\\b[^>]*\\br=['"]L${totalRow}['"]`).test(xml)) {
      xml = setXlsxInlineCell(xml, `L${totalRow}`, "");
    }
    if (new RegExp(`<c\\b[^>]*\\br=['"]M${totalRow}['"]`).test(xml)) {
      xml = setXlsxInlineCell(xml, `M${totalRow}`, formatNumberStr(total));
    }
    if (new RegExp(`<c\\b[^>]*\\br=['"]N${totalRow}['"]`).test(xml)) {
      xml = setXlsxInlineCell(xml, `N${totalRow}`, unit);
    }

    for (let r = totalRow + 1; r <= 31; r++) {
      if (new RegExp(`<c\\b[^>]*\\br=['"]K${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `K${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]L${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `L${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]M${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `M${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]N${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `N${r}`, "");
    }
  } else if (total) {
    const totalLabel = isThai ? "รวม/รุ่น" : "Total/Batch";
    if (new RegExp(`<c\\b[^>]*\\br=['"]K25['"]`).test(xml)) xml = setXlsxInlineCell(xml, "K25", totalLabel);
    if (new RegExp(`<c\\b[^>]*\\br=['"]L25['"]`).test(xml)) xml = setXlsxInlineCell(xml, "L25", "");
    if (new RegExp(`<c\\b[^>]*\\br=['"]M25['"]`).test(xml)) xml = setXlsxInlineCell(xml, "M25", formatNumberStr(total));
    if (new RegExp(`<c\\b[^>]*\\br=['"]N25['"]`).test(xml)) xml = setXlsxInlineCell(xml, "N25", unit);

    for (let r = 26; r <= 31; r++) {
      if (new RegExp(`<c\\b[^>]*\\br=['"]K${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `K${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]L${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `L${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]M${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `M${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]N${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `N${r}`, "");
    }
  } else {
    if (new RegExp(`<c\\b[^>]*\\br=['"]K25['"]`).test(xml)) xml = setXlsxInlineCell(xml, "K25", "-");
    for (let r = 26; r <= 31; r++) {
      if (new RegExp(`<c\\b[^>]*\\br=['"]K${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `K${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]L${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `L${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]M${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `M${r}`, "");
      if (new RegExp(`<c\\b[^>]*\\br=['"]N${r}['"]`).test(xml)) xml = setXlsxInlineCell(xml, `N${r}`, "");
    }
  }

  return xml;
};

const setDrawingTextboxText = (
  drawingXml: string,
  fromRow: number,
  toRow: number,
  value: string,
  fontSize: string = "1600",
) => {
  const lines = (value.trim() || "-").split(/\r?\n/);
  const paragraphXml = lines
    .map(
      (line) =>
        `<a:p><a:r><a:rPr lang="th-TH" sz="${fontSize}"><a:solidFill><a:sysClr val="windowText" lastClr="000000"/></a:solidFill><a:latin typeface="Cordia New"/><a:cs typeface="Cordia New"/></a:rPr><a:t>${escapeXlsxXml(line)}</a:t></a:r></a:p>`
    )
    .join("");

  const anchorRegex = new RegExp(
    `(<xdr:twoCellAnchor[^>]*>[\\s\\S]*?<xdr:from>[\\s\\S]*?<xdr:row>${fromRow}<\\/xdr:row>[\\s\\S]*?<xdr:to>[\\s\\S]*?<xdr:row>${toRow}<\\/xdr:row>[\\s\\S]*?<xdr:txBody>)[\\s\\S]*?(<\\/xdr:txBody>[\\s\\S]*?<\\/xdr:twoCellAnchor>)`
  );

  const match = drawingXml.match(anchorRegex);
  if (!match) return drawingXml;

  return drawingXml.replace(
    match[0],
    `${match[1]}<a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor="t"/><a:lstStyle/>${paragraphXml}${match[2]}`
  );
};

const fillOutlineSheet = (
  templateXml: string,
  course: WorkflowCourse,
  standard: WorkflowStandard | null | undefined,
  oapPlan: WorkflowOapPlan | null | undefined,
  language: "th" | "en",
  scheduleData?: { date?: string; time?: string; location?: string } | null,
  budgetData?: BudgetData | null,
) => {
  const isThai = language === "th";
  const title = isThai
    ? course.courseNameTh || course.courseNameEn
    : course.courseNameEn || course.courseNameTh;

  let xml = templateXml;

  // Course Title header at B7
  if (new RegExp(`<c\\b[^>]*\\br=['"]B7['"]`).test(xml)) {
    xml = setXlsxInlineCell(
      xml,
      "B7",
      `${isThai ? "หลักสูตร" : "Course"} ${title} (${course.courseCode})`,
    );
  }

  // Clear underlying cells that correspond to textboxes to avoid double text overlap
  xml = setTextBlock(xml, ["B10", "B11", "B12", "B13", "B14", "B15", "B16"], "", 65);
  xml = setTextBlock(xml, ["B19", "B20", "B21", "B22", "B23", "B24", "B25", "B26", "B27"], "", 65);
  xml = setTextBlock(xml, ["B29", "B30", "B31", "B32", "B33", "B34", "B35", "B36", "B37", "B38"], "", 65);
  xml = setTextBlock(xml, ["K14", "K15", "K16", "K17"], "", 50);

  // Instructor cell K10 or C9
  const instructor = oapPlan ? [oapPlan.trainer, oapPlan.provider].filter(Boolean).join(" / ") || "-" : "-";
  if (new RegExp(`<c\\b[^>]*\\br=['"]K10['"]`).test(xml)) {
    xml = setXlsxInlineCell(xml, "K10", instructor);
  }

  // Schedule cells
  const dateVal = scheduleData?.date || "";
  const timeVal = scheduleData?.time || (oapPlan?.hours ? `${oapPlan.hours} ${isThai ? "ชั่วโมง" : "hrs"}` : "");
  const locVal = scheduleData?.location || "";

  if (new RegExp(`<c\\b[^>]*\\br=['"]K19['"]`).test(xml)) {
    xml = setXlsxInlineCell(xml, "K19", `${isThai ? "วันที่ :" : "Date:"} ${dateVal || "-"}`);
  }
  if (new RegExp(`<c\\b[^>]*\\br=['"]K20['"]`).test(xml)) {
    xml = setXlsxInlineCell(xml, "K20", `${isThai ? "เวลา :" : "Time:"} ${timeVal || "-"}`);
  }
  if (new RegExp(`<c\\b[^>]*\\br=['"]K21['"]`).test(xml)) {
    xml = setXlsxInlineCell(xml, "K21", `${isThai ? "สถานที่ :" : "Location:"} ${locVal || "-"}`);
  }

  // Multi-column Budget in K, L, M, N
  xml = fillBudgetMultiColumn(xml, budgetData, oapPlan, language);

  // Evaluation in K33:K39
  return setTextBlock(
    xml,
    ["K34", "K35", "K36", "K37", "K38", "K39"],
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
  budget?: BudgetData | null,
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

    const drawingEntry = entries.find(
      (entry) => entry.name === `xl/drawings/drawing${sheetNumber}.xml`,
    );
    if (drawingEntry) {
      const hasRemark = Boolean(course.remark && course.remark.trim() !== "" && course.remark.trim() !== "-");
      const background = hasRemark ? course.remark.trim() : "-";
      const instructor = oapPlan ? [oapPlan.trainer, oapPlan.provider].filter(Boolean).join(" / ") || "-" : "-";
      const targetGroup = buildTargetGroup(course, standard, language);

      let drawingXml = drawingEntry.data.toString("utf8");
      // Use sz="1600" (16pt Cordia New) for clear readable text in textboxes
      drawingXml = setDrawingTextboxText(drawingXml, 9, 17, background, "1600");
      drawingXml = setDrawingTextboxText(drawingXml, 18, 27, course.objective, "1600");
      drawingXml = setDrawingTextboxText(drawingXml, 28, 38, course.learningContent, "1600");
      drawingXml = setDrawingTextboxText(drawingXml, 13, 16, targetGroup, "1600");
      drawingXml = setDrawingTextboxText(drawingXml, 9, 12, instructor, "1600");
      drawingEntry.data = Buffer.from(drawingXml, "utf8");
    }
  }
  return writeXlsxEntries(entries);
};
