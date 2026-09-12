import { escapeXlsxXml, writeXlsxEntries, type XlsxEntry } from "../xlsxTemplate";

export const INSTRUCTOR_TEMPLATE_HEADERS = [
  "ชื่อ (First Name) *",
  "นามสกุล (Last Name) *",
  "เบอร์โทรศัพท์ (Telephone)",
  "อีเมล (Email)",
  "ระดับการศึกษา / วุฒิ (Education)",
  "มหาวิทยาลัย (University)",
  "หน่วยงาน / สังกัด (Organization)",
];

const colLetter = (colIndex: number): string => {
  let temp = colIndex;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export const buildInstructorXlsxTemplate = (): Buffer => {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Instructor_Template" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Segoe UI"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FFFFFFFF"/>
      <name val="Segoe UI"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF007A3D"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  // Build sheet data with header row only
  let rowXml = `<row r="1" ht="30" customHeight="1">`;
  INSTRUCTOR_TEMPLATE_HEADERS.forEach((header, colIdx) => {
    const cellRef = `${colLetter(colIdx)}1`;
    rowXml += `<c r="${cellRef}" s="1" t="inlineStr"><is><t xml:space="preserve">${escapeXlsxXml(header)}</t></is></c>`;
  });
  rowXml += `</row>`;

  const lastCol = colLetter(INSTRUCTOR_TEMPLATE_HEADERS.length - 1);

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}1"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>
    <col min="1" max="1" width="24" customWidth="1"/>
    <col min="2" max="2" width="24" customWidth="1"/>
    <col min="3" max="3" width="20" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="32" customWidth="1"/>
    <col min="6" max="6" width="30" customWidth="1"/>
    <col min="7" max="7" width="35" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowXml}
  </sheetData>
</worksheet>`;

  const entries: XlsxEntry[] = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(contentTypesXml, "utf8"),
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(rootRelsXml, "utf8"),
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(workbookRelsXml, "utf8"),
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(workbookXml, "utf8"),
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    },
    {
      name: "xl/styles.xml",
      data: Buffer.from(stylesXml, "utf8"),
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.from(sheet1Xml, "utf8"),
      compressionMethod: 0,
      modifiedTime: 0,
      modifiedDate: 0,
      externalAttributes: 0,
    },
  ];

  return writeXlsxEntries(entries);
};

export const buildInstructorCsvTemplate = (): string => {
  const bom = "\uFEFF";
  return (
    bom +
    INSTRUCTOR_TEMPLATE_HEADERS.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",") +
    "\r\n"
  );
};
