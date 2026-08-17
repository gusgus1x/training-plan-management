import {
  getParticipantName,
  type AttendanceSheetCourse,
  type AttendanceSheetParticipant,
} from "./attendanceSheetExport";
import {
  escapeXlsxXml as escapeXml,
  readXlsxEntries as readZipEntries,
  readXlsxEntry,
  setXlsxInlineCell as setInlineCell,
  writeXlsxEntries as writeZipEntries,
  type XlsxEntry as ZipEntry,
} from "./xlsxTemplate";

const TEMPLATE_PARTICIPANT_ROWS = 30;
const FIRST_PARTICIPANT_ROW = 11;
const WORKSHEET_PATH = "xl/worksheets/sheet1.xml";
const WORKSHEET_RELS_PATH = "xl/worksheets/_rels/sheet1.xml.rels";
const DRAWING_PATH = "xl/drawings/drawing1.xml";
const DRAWING_RELS_PATH = "xl/drawings/_rels/drawing1.xml.rels";
const PRINTER_SETTINGS_PATH = "xl/printerSettings/printerSettings1.bin";

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const getCourseDetailLine = (course: AttendanceSheetCourse) => {
  const parsedDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec((course.date || "").trim());
  const dateText = parsedDate
    ? `วันที่ ${Number(parsedDate[3])} เดือน ${thaiMonths[Number(parsedDate[2]) - 1]} พ.ศ. ${Number(parsedDate[1]) + 543}`
    : `วันที่ --- เดือน --- พ.ศ. ---`;
  const time = [course.startTime, course.endTime].filter(Boolean).join(" - ");
  const timeText = time ? `เวลา ${time} น.` : `เวลา --- น.`;
  const locationText = `สถานที่ ${course.location && course.location !== "-" ? course.location : "---"}`;
  const trainerText = `วิทยากร ${course.trainer && course.trainer !== "-" ? course.trainer : "---"}`;

  return [
    dateText,
    timeText,
    locationText,
    trainerText,
  ].join("   ");
};

export { readXlsxEntry };

const getRequiredEntry = (entries: ZipEntry[], entryName: string) => {
  const entry = entries.find((item) => item.name === entryName);
  if (!entry) {
    throw new Error(`Invalid Excel template: ${entryName} was not found.`);
  }
  return entry;
};

const cloneEntry = (source: ZipEntry, name: string, data = source.data): ZipEntry => ({
  ...source,
  name,
  data: Buffer.from(data),
});

const centerCourseTitleStyle = (
  entries: ZipEntry[],
  worksheetXml: string,
) => {
  const titleStyleId = Number(
    worksheetXml.match(/<c\b[^>]*\br=["']B5["'][^>]*\bs=["'](\d+)["']/)?.[1],
  );
  if (!Number.isInteger(titleStyleId)) {
    throw new Error("Invalid Excel template: course title style was not found.");
  }

  const styles = getRequiredEntry(entries, "xl/styles.xml");
  let stylesXml = styles.data.toString("utf8");
  const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  const cellStyleXml = cellXfs?.[1] ?? "";
  const styleEntries = [...cellStyleXml.matchAll(/<xf\b/g)].map((match) => {
    const start = match.index;
    const openingEnd = cellStyleXml.indexOf(">", start);
    const isSelfClosing = cellStyleXml[openingEnd - 1] === "/";
    const end = isSelfClosing
      ? openingEnd + 1
      : cellStyleXml.indexOf("</xf>", openingEnd) + "</xf>".length;
    return cellStyleXml.slice(start, end);
  });
  const titleStyle = styleEntries?.[titleStyleId];
  if (!cellXfs || !styleEntries || !titleStyle) {
    throw new Error("Invalid Excel template: course title cell style was not found.");
  }

  const centeredTitleStyle = /horizontal=["'][^"']*["']/.test(titleStyle)
    ? titleStyle.replace(/horizontal=["'][^"']*["']/, 'horizontal="center"')
    : titleStyle.replace(/<alignment\b/, '<alignment horizontal="center"');
  stylesXml = stylesXml.replace(titleStyle, centeredTitleStyle);
  styles.data = Buffer.from(stylesXml, "utf8");
};

const formatAttendanceEmployeeId = (id?: string) => {
  if (!id) return "";
  const trimmed = id.trim();
  return trimmed.length > 5 ? trimmed.slice(-5) : trimmed;
};

const fillAttendanceWorksheet = (
  templateXml: string,
  course: AttendanceSheetCourse,
  participants: AttendanceSheetParticipant[],
  participantOffset: number,
  sheetNumber: number,
) => {
  let worksheetXml = templateXml;
  const courseNamePart = [course.code, course.title].filter(Boolean).join(" ");
  const courseTitle = [
    `หลักสูตร ${courseNamePart}`.trim(),
    course.batch ? `รุ่น ${course.batch}` : "",
  ]
    .filter(Boolean)
    .join("   ");
  worksheetXml = setInlineCell(worksheetXml, "B5", courseTitle);
  worksheetXml = setInlineCell(worksheetXml, "B7", getCourseDetailLine(course));

  for (let index = 0; index < TEMPLATE_PARTICIPANT_ROWS; index += 1) {
    const row = FIRST_PARTICIPANT_ROW + index;
    const participant = participants[index];
    const name = participant
      ? getParticipantName(participant)
      : { prefix: "", firstName: "", lastName: "" };
    const values: Record<string, string | number> = {
      B: participant ? participantOffset + index + 1 : "",
      C: participant?.company ?? "",
      D: formatAttendanceEmployeeId(participant?.id),
      E: name.prefix,
      F: name.firstName,
      G: name.lastName,
      H: participant?.position ?? "",
      I: participant?.department ?? "",
      J: "",
      K: "",
      L: "",
      M: "",
    };

    for (const [column, value] of Object.entries(values)) {
      worksheetXml = setInlineCell(worksheetXml, `${column}${row}`, value);
    }
  }

  if (sheetNumber > 1) {
    worksheetXml = worksheetXml.replace(' tabSelected="1"', "");
    worksheetXml = worksheetXml.replace(
      /xr:uid="\{[^}]+\}"/,
      `xr:uid="{00000000-0000-0000-0000-${String(sheetNumber).padStart(12, "0")}}"`,
    );
  }

  return worksheetXml;
};

const updateWorkbookMetadata = (
  entries: ZipEntry[],
  sheetNames: string[],
  workbookRelationshipIds: string[],
) => {
  const workbook = getRequiredEntry(entries, "xl/workbook.xml");
  let workbookXml = workbook.data.toString("utf8");
  const originalSheet = workbookXml.match(/<sheet\b[^>]*\bsheetId="1"[^>]*\/>/);
  const originalName = originalSheet?.[0].match(/\bname="([^"]+)"/)?.[1];
  const originalRelationshipId = originalSheet?.[0].match(/\br:id="([^"]+)"/)?.[1];
  if (!originalSheet || !originalName || !originalRelationshipId) {
    throw new Error("Invalid Excel template: workbook sheet metadata was not found.");
  }

  const sheetElements = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="${index === 0 ? originalRelationshipId : workbookRelationshipIds[index - 1]}"/>`,
    )
    .join("");
  workbookXml = workbookXml.replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${sheetElements}</sheets>`);
  workbookXml = workbookXml.replace(
    new RegExp(`${originalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}!`, "g"),
    `'${sheetNames[0].replace(/'/g, "''")}'!`,
  );

  const additionalPrintAreas = sheetNames
    .slice(1)
    .map(
      (name, index) =>
        `<definedName name="_xlnm.Print_Area" localSheetId="${index + 1}">'${name.replace(/'/g, "''")}'!$B$1:$M$44</definedName>`,
    )
    .join("");
  workbookXml = workbookXml.replace(
    "</definedNames>",
    `${additionalPrintAreas}</definedNames>`,
  );
  workbook.data = Buffer.from(workbookXml, "utf8");

  const appProperties = entries.find((entry) => entry.name === "docProps/app.xml");
  if (appProperties) {
    let appXml = appProperties.data.toString("utf8");
    appXml = appXml.replace(
      /(<vt:lpstr>Worksheets<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)\d+(<\/vt:i4>)/,
      `$1${sheetNames.length}$2`,
    );
    appXml = appXml.replace(
      /(<vt:lpstr>Named Ranges<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)\d+(<\/vt:i4>)/,
      `$1${sheetNames.length}$2`,
    );
    const partTitles = [
      ...sheetNames,
      ...sheetNames.map((name) => `${name}!Print_Area`),
    ]
      .map((title) => `<vt:lpstr>${escapeXml(title)}</vt:lpstr>`)
      .join("");
    appXml = appXml.replace(
      /<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/,
      `<TitlesOfParts><vt:vector size="${sheetNames.length * 2}" baseType="lpstr">${partTitles}</vt:vector></TitlesOfParts>`,
    );
    appProperties.data = Buffer.from(appXml, "utf8");
  }
};

const ensureDateLineShape = (drawingXml: string): string => {
  if (
    drawingXml.includes('name="Line 22"') ||
    drawingXml.includes("<xdr:row>6</xdr:row>")
  ) {
    return drawingXml;
  }

  const dateLineShape = `<xdr:twoCellAnchor><xdr:from><xdr:col>4</xdr:col><xdr:colOff>314325</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>286616</xdr:rowOff></xdr:from><xdr:to><xdr:col>11</xdr:col><xdr:colOff>1053812</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>286616</xdr:rowOff></xdr:to><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="22" name="Line 22"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{465B87AE-6E01-49E5-8675-11AAD653F6C8}"/></a:ext></a:extLst></xdr:cNvPr><xdr:cNvSpPr><a:spLocks noChangeShapeType="1"/></xdr:cNvSpPr></xdr:nvSpPr><xdr:spPr bwMode="auto"><a:xfrm><a:off x="2280285" y="2105816"/><a:ext cx="8382347" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:prstDash val="dash"/><a:round/><a:headEnd/><a:tailEnd/></a:ln></xdr:spPr></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>`;

  return drawingXml.replace("</xdr:wsDr>", `${dateLineShape}</xdr:wsDr>`);
};

export const buildAttendanceWorkbook = (
  template: Buffer,
  course: AttendanceSheetCourse,
  participants: AttendanceSheetParticipant[],
) => {
  const entries = readZipEntries(template);
  const worksheet = getRequiredEntry(entries, WORKSHEET_PATH);
  const worksheetRels = getRequiredEntry(entries, WORKSHEET_RELS_PATH);
  const drawing = getRequiredEntry(entries, DRAWING_PATH);
  drawing.data = Buffer.from(
    ensureDateLineShape(drawing.data.toString("utf8")),
    "utf8",
  );
  const drawingRels = getRequiredEntry(entries, DRAWING_RELS_PATH);
  const printerSettings = getRequiredEntry(entries, PRINTER_SETTINGS_PATH);
  const templateWorksheetXml = worksheet.data.toString("utf8");
  centerCourseTitleStyle(entries, templateWorksheetXml);
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(participants.length / TEMPLATE_PARTICIPANT_ROWS)) },
    (_, index) =>
      participants.slice(
        index * TEMPLATE_PARTICIPANT_ROWS,
        (index + 1) * TEMPLATE_PARTICIPANT_ROWS,
      ),
  );
  const sheetNames = chunks.map((chunk, index) => {
    const first = index * TEMPLATE_PARTICIPANT_ROWS + 1;
    const last = first + Math.max(chunk.length, 1) - 1;
    return chunks.length === 1 ? "รายชื่อผู้เข้าอบรม" : `รายชื่อ ${first}-${last}`;
  });

  const workbookRels = getRequiredEntry(entries, "xl/_rels/workbook.xml.rels");
  let workbookRelsXml = workbookRels.data.toString("utf8");
  const relationshipNumbers = [...workbookRelsXml.matchAll(/\bId="rId(\d+)"/g)].map(
    (match) => Number(match[1]),
  );
  const firstNewRelationshipNumber = Math.max(...relationshipNumbers) + 1;
  const workbookRelationshipIds: string[] = [];
  const contentTypes = getRequiredEntry(entries, "[Content_Types].xml");
  let contentTypesXml = contentTypes.data.toString("utf8");

  chunks.forEach((chunk, index) => {
    const sheetNumber = index + 1;
    const participantOffset = index * TEMPLATE_PARTICIPANT_ROWS;
    const filledXml = fillAttendanceWorksheet(
      templateWorksheetXml,
      course,
      chunk,
      participantOffset,
      sheetNumber,
    );

    if (sheetNumber === 1) {
      worksheet.data = Buffer.from(filledXml, "utf8");
      return;
    }

    const workbookRelationshipId = `rId${firstNewRelationshipNumber + index - 1}`;
    workbookRelationshipIds.push(workbookRelationshipId);
    entries.push(
      cloneEntry(
        worksheet,
        `xl/worksheets/sheet${sheetNumber}.xml`,
        Buffer.from(filledXml, "utf8"),
      ),
      cloneEntry(
        worksheetRels,
        `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`,
        Buffer.from(
          worksheetRels.data
            .toString("utf8")
            .replace("drawing1.xml", `drawing${sheetNumber}.xml`)
            .replace(
              "printerSettings1.bin",
              `printerSettings${sheetNumber}.bin`,
            ),
          "utf8",
        ),
      ),
      cloneEntry(drawing, `xl/drawings/drawing${sheetNumber}.xml`),
      cloneEntry(
        drawingRels,
        `xl/drawings/_rels/drawing${sheetNumber}.xml.rels`,
      ),
      cloneEntry(
        printerSettings,
        `xl/printerSettings/printerSettings${sheetNumber}.bin`,
      ),
    );
    workbookRelsXml = workbookRelsXml.replace(
      "</Relationships>",
      `<Relationship Id="${workbookRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/></Relationships>`,
    );
    contentTypesXml = contentTypesXml.replace(
      "</Types>",
      `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    );
  });

  workbookRels.data = Buffer.from(workbookRelsXml, "utf8");
  contentTypes.data = Buffer.from(contentTypesXml, "utf8");
  updateWorkbookMetadata(entries, sheetNames, workbookRelationshipIds);
  return writeZipEntries(entries);
};
