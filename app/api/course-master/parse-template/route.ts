import { NextRequest, NextResponse } from "next/server";
import zlib from "zlib";
import { CourseMasterImportRow, parseCsvText } from "../../../lib/excelHelper";

function decodeXmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function formatMultiline(str: string | undefined): string {
  if (!str) return "-";
  let cleaned = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Ensure numbered items like "1. ... 2. ..." are separated by newlines if running together
  cleaned = cleaned.replace(/([^\n])\s+(\d+[\.\)])\s+/g, "$1\n$2 ");
  return cleaned.trim() || "-";
}

export function parseXlsxBuffer(buffer: Buffer): CourseMasterImportRow[] {
  const entries: Record<string, string> = {};
  let offset = 0;

  while (offset < buffer.length - 4) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileName = buffer.toString("utf8", offset + 30, offset + 30 + fileNameLength);
    const fileDataOffset = offset + 30 + fileNameLength + extraFieldLength;
    const compressedData = buffer.subarray(fileDataOffset, fileDataOffset + compressedSize);

    let uncompressedData: Buffer | undefined;
    if (compressionMethod === 0) {
      uncompressedData = compressedData;
    } else if (compressionMethod === 8) {
      try {
        uncompressedData = zlib.inflateRawSync(compressedData);
      } catch {
        // ignore individual corrupt entry
      }
    }

    if (uncompressedData) {
      entries[fileName] = uncompressedData.toString("utf8");
    }

    offset = fileDataOffset + compressedSize;
  }

  // 1. Shared Strings
  const sharedStrings: string[] = [];
  if (entries["xl/sharedStrings.xml"]) {
    const sstXml = entries["xl/sharedStrings.xml"];
    const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let match: RegExpExecArray | null;
    while ((match = siRegex.exec(sstXml)) !== null) {
      const siContent = match[1];
      const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let text = "";
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        text += tMatch[1];
      }
      sharedStrings.push(decodeXmlEntities(text));
    }
  }

  // 2. Sheet1
  const sheetEntryKey = Object.keys(entries).find(
    (k) => k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml"),
  );
  if (!sheetEntryKey) return [];

  const sheetXml = entries[sheetEntryKey];
  const rowRegex = /<row\b([^>]*?)>([\s\S]*?)<\/row>/g;
  const rawRows: Array<{ rNum: number; cells: Record<string, string> }> = [];

  let rMatch: RegExpExecArray | null;
  while ((rMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowAttr = rMatch[1];
    const rowContent = rMatch[2];
    const rNumMatch = /r="(\d+)"/.exec(rowAttr);
    const rNum = rNumMatch ? parseInt(rNumMatch[1], 10) : 0;
    const cells: Record<string, string> = {};

    const cellRegex = /<c\b([^>]*?)(?:>([\s\S]*?)<\/c>|\/>)/g;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = cellRegex.exec(rowContent)) !== null) {
      const cAttr = cMatch[1];
      const cBody = cMatch[2] || "";

      const rAttrMatch = /r="([A-Z]+)(\d+)"/.exec(cAttr);
      if (!rAttrMatch) continue;
      const col = rAttrMatch[1];

      const tAttrMatch = /t="([^"]*)"/.exec(cAttr);
      const t = tAttrMatch ? tAttrMatch[1] : "";

      let val = "";
      const vMatch = /<v>([\s\S]*?)<\/v>/.exec(cBody);
      if (vMatch) {
        val = vMatch[1];
        if (t === "s") {
          val = sharedStrings[parseInt(val, 10)] || "";
        } else {
          val = decodeXmlEntities(val);
        }
      } else {
        const isMatch = /<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/.exec(cBody);
        if (isMatch) {
          val = decodeXmlEntities(isMatch[1]);
        }
      }
      cells[col] = val.trim();
    }
    if (Object.keys(cells).length > 0) {
      rawRows.push({ rNum, cells });
    }
  }

  if (rawRows.length <= 1) return [];

  const row2 = rawRows.find(r => r.rNum === 2);
  const row4 = rawRows.find(r => r.rNum === 4);
  const row6 = rawRows.find(r => r.rNum === 6);
  const row2Values = row2 ? Object.values(row2.cells).join(" ").toLowerCase() : "";
  const row4Values = row4 ? Object.values(row4.cells).join(" ").toLowerCase() : "";

  // ── AT-A Master Course Import Export format ──────────────────────────────
  // Identified by Row 2 containing "Master Training Course" or Row 4 containing course headers
  // Exact column mapping:
  //   - Course Group: C
  //   - Course Code: B
  //   - Course Type: AO (fallback F)
  //   - Course Name (TH): L
  //   - Course Name (EN): K
  //   - ที่มา (Background): AD
  //   - Objective: AF
  //   - Learning Content: AE
  //   - Target Group: N
  //   - Methodology: AA (Lecture), AB (Workshop), AC (OJT)
  //   - Check List Level: O (O1), P (O2), Q (O3), R (O4), S (O5), T (S1), U (S2), V (S3), W (S4), X (M1), Y (M2), Z (M3)
  //
  // Data starts at Row 7+
  const isAtaTemplate = row2Values.includes("master training course") ||
    row4Values.includes("subject(course group)") ||
    row4Values.includes("learning content") ||
    ((row4Values.includes("cousre code") || row4Values.includes("course code")) &&
    row4Values.includes("course name"));

  if (isAtaTemplate) {
    // Target Level columns (O=O1, P=O2 ... Z=M3)
    const levelMap: Array<{ col: string; name: string }> = [
      { col: "O", name: "O1" },
      { col: "P", name: "O2" },
      { col: "Q", name: "O3" },
      { col: "R", name: "O4" },
      { col: "S", name: "O5" },
      { col: "T", name: "S1" },
      { col: "U", name: "S2" },
      { col: "V", name: "S3" },
      { col: "W", name: "S4" },
      { col: "X", name: "M1" },
      { col: "Y", name: "M2" },
      { col: "Z", name: "M3" },
    ];

    // Training Location Type (Row 6): D=Inside, E=Outside, F=Inhouse, G=Online, H=Public, I=Inside, J=Outside
    const locationTypeCols = [
      { col: "D", name: "Inside" },
      { col: "E", name: "Outside" },
      { col: "F", name: "Inhouse" },
      { col: "G", name: "Online" },
      { col: "H", name: "Public" },
      { col: "I", name: "Inside(plant)" },
      { col: "J", name: "Outside(class)" },
    ];

    const isSelectedVal = (val: string | undefined): boolean => {
      if (!val) return false;
      const clean = val.toString().trim().toLowerCase();
      return clean !== "" && clean !== "0" && clean !== "-" && clean !== "false" && clean !== "no";
    };

    const isMarkOnly = (val: string): boolean => {
      const clean = val.trim().toLowerCase();
      return clean === "1" || clean === "x" || clean === "y" || clean === "yes" || clean === "✓" || clean === "true" || clean === "p" || clean === "/" || clean === "v";
    };

    const rows: CourseMasterImportRow[] = [];
    for (const r of rawRows) {
      if (r.rNum < 7) continue; // Data starts at Row 7
      const cells = r.cells;

      const courseCode    = (cells["B"] || "").trim();
      const courseGroup   = (cells["C"] || "General").trim();
      const instructor    = (cells["D"] || "").trim();
      const courseType    = (cells["AO"] || "").trim();
      const courseNameEn  = (cells["K"] || "").trim();
      const courseNameTh  = (cells["L"] || "").trim();
      const targetGroup   = (cells["N"] || "-").trim();
      const levelText     = (cells["O"] || "").trim();
      const background    = (cells["AD"] || "").trim();
      const learningContent = (cells["AE"] || "-").trim();
      const objective     = (cells["AF"] || "-").trim();

      // Skip empty rows or accidental header repetitions
      if (!courseNameTh && !courseNameEn && !courseCode) continue;
      if ((courseNameTh + courseNameEn).toLowerCase().includes("course name")) continue;

      // Extract target levels from check list O P Q R S T U V W X Y Z
      const matchedLevels: string[] = [];
      levelMap.forEach(({ col, name }) => {
        if (isSelectedVal(cells[col])) {
          matchedLevels.push(name);
        }
      });
      // Fallback: use free-text level from column O if no checkboxes matched and O has descriptive text
      if (matchedLevels.length === 0 && levelText && !levelText.toLowerCase().includes("level") && !isMarkOnly(levelText)) {
        matchedLevels.push(levelText);
      }

      // Build methodology from AA (Lecture), AB (Workshop), AC (OJT)
      const methodologies: string[] = [];
      if (isSelectedVal(cells["AA"])) {
        const val = (cells["AA"] || "").trim();
        methodologies.push(isMarkOnly(val) ? "Lecture" : val);
      }
      if (isSelectedVal(cells["AB"])) {
        const val = (cells["AB"] || "").trim();
        methodologies.push(isMarkOnly(val) ? "Workshop" : val);
      }
      if (isSelectedVal(cells["AC"])) {
        const val = (cells["AC"] || "").trim();
        methodologies.push(isMarkOnly(val) ? "OJT" : val);
      }

      const methodologyStr = methodologies.length > 0
        ? methodologies.join(" / ")
        : "-";

      rows.push({
        rowNum: r.rNum,
        courseCode,
        courseNameTh: courseNameTh || courseNameEn || courseCode,
        courseNameEn: courseNameEn || "-",
        courseGroup,
        courseType,
        background: formatMultiline(background),
        objective: formatMultiline(objective),
        learningContent: formatMultiline(learningContent),
        targetGroup: targetGroup || "-",
        methodology: methodologyStr,
        lifeCycleMonth: "",
        preTest: "-",
        postTest: "-",
        functionCode: "",
        functionName: instructor,
        positions: "",
        levels: matchedLevels.join(", "),
      });
    }

    if (rows.length > 0) return rows;
  }

  // ── Legacy multi-row header parsing (Master Course Import Tem) ────────────
  const isMultiRowHeader = rawRows.some(r => r.rNum === 4 || r.rNum === 6);

  if (isMultiRowHeader && (row4Values.includes("code") || row4Values.includes("subject") || row4Values.includes("group") || row4Values.includes("target") || rawRows.some(r => r.rNum >= 7))) {
    // Multi-row header parsing (Master Course Import Tem)
    const levelCols = ["N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y"];
    const levelNames = ["O1", "O2", "O3", "O4", "O5", "S1", "S2", "S3", "S4", "M1", "M2", "M3"];

    const isSelectedVal = (val: string | undefined): boolean => {
      if (!val) return false;
      const clean = val.toString().trim().toLowerCase();
      return clean !== "" && clean !== "0" && clean !== "-" && clean !== "false";
    };

    const rows: CourseMasterImportRow[] = [];
    for (const r of rawRows) {
      if (r.rNum < 7) continue; // Data starts at Row 7
      const cells = r.cells;
      const courseCode = cells["B"] || "";
      const courseGroup = cells["C"] || "General";
      const courseName = (cells["K"] || cells["J"] || "").trim();
      const targetGroup = cells["M"] || "-";
      const learningContent = cells["Z"] || "-";
      const objective = cells["AA"] || "-";
      const courseType = cells["BU"] || cells["BB"] || "";

      if (!courseName || courseName === "-" || courseName === "Course Name (TH/EN)" || courseName.toLowerCase().includes("course name")) continue;

      // Extract Levels from columns N to Y
      const matchedLevels: string[] = [];
      levelCols.forEach((col, idx) => {
        if (isSelectedVal(cells[col])) {
          matchedLevels.push(levelNames[idx]);
        }
      });

      rows.push({
        rowNum: r.rNum,
        courseCode,
        courseNameTh: courseName,
        courseNameEn: courseName,
        courseGroup,
        courseType,
        objective: formatMultiline(objective),
        learningContent: formatMultiline(learningContent),
        targetGroup,
        methodology: "Lecture / Workshop",
        lifeCycleMonth: "0",
        preTest: "-",
        postTest: "-",
        functionCode: "",
        functionName: "",
        positions: "",
        levels: matchedLevels.join(", "),
      });
    }
    if (rows.length > 0) return rows;
  }

  // Single-row header parsing
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const vals = Object.values(rawRows[i].cells).map((v) => v.toLowerCase());
    if (vals.some((v) => v.includes("code") || v.includes("subject") || v.includes("course") || v.includes("ชื่อหลักสูตร"))) {
      headerRowIndex = i;
      break;
    }
  }

  const headerCells = rawRows[headerRowIndex].cells;
  const colToHeader: Record<string, string> = {};
  for (const [col, val] of Object.entries(headerCells)) {
    colToHeader[col] = (val || "").trim().toLowerCase();
  }

  const findCol = (...keys: string[]) => {
    // 1. Try exact match first
    for (const [col, h] of Object.entries(colToHeader)) {
      if (keys.some((k) => h === k.toLowerCase())) {
        return col;
      }
    }
    // 2. Try prefix/contains match
    for (const [col, h] of Object.entries(colToHeader)) {
      if (keys.some((k) => h.includes(k.toLowerCase()))) {
        return col;
      }
    }
    return null;
  };

  const codeCol = findCol("course code", "code", "รหัสหลักสูตร", "รหัส");
  const nameThCol = findCol("course name(th)", "course name (th)", "course name th", "ชื่อหลักสูตร (th)", "ชื่อหลักสูตร ภาษาไทย", "nameth");
  const nameEnCol = findCol("course name(en)", "course name (en)", "course name en", "ชื่อหลักสูตร (en)", "ชื่อหลักสูตร ภาษาอังกฤษ", "nameen");
  const objCol = findCol("objective", "วัตถุประสงค์");
  const contentCol = findCol("learning content", "content", "เนื้อหา", "เนื้อหาหลักสูตร");
  const targetGroupCol = findCol("target group", "target", "กลุ่มเป้าหมาย");
  const methodCol = findCol("methodology", "วิธีการ");
  const lifeCol = findCol("life cycle", "life cycle (month)", "life", "อายุการอบรม");
  const typeCol = findCol("course type", "type", "ประเภทหลักสูตร", "ประเภท");
  
  // For group: ensure it does not pick targetGroupCol
  let groupCol = findCol("course group", "กลุ่มหลักสูตร", "หมวดหมู่", "subject");
  if (!groupCol) {
    for (const [col, h] of Object.entries(colToHeader)) {
      if (col !== targetGroupCol && (h === "group" || (h.includes("group") && !h.includes("target")))) {
        groupCol = col;
        break;
      }
    }
  }

  const rows: CourseMasterImportRow[] = [];
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const cells = rawRows[i].cells;
    const courseCode = (codeCol && cells[codeCol]) || "";
    const courseNameTh = (nameThCol && cells[nameThCol]) || cells["B"] || cells["A"] || "";
    const courseNameEn = (nameEnCol && cells[nameEnCol]) || courseNameTh;
    const objective = (objCol && cells[objCol]) || cells["AA"] || cells["D"] || "-";
    const learningContent = (contentCol && cells[contentCol]) || cells["Z"] || cells["E"] || "-";
    const targetGroup = (targetGroupCol && cells[targetGroupCol]) || "-";
    const methodology = (methodCol && cells[methodCol]) || "Lecture / Workshop";
    const lifeCycleMonth = (lifeCol && cells[lifeCol]) || "0";
    const courseType = (typeCol && cells[typeCol]) || "ATA-TC";
    const courseGroup = (groupCol && cells[groupCol]) || "General";

    if (!courseNameTh && !courseCode) continue;

    rows.push({
      rowNum: rawRows[i].rNum,
      courseCode,
      courseNameTh,
      courseNameEn,
      courseGroup,
      courseType,
      objective: formatMultiline(objective),
      learningContent: formatMultiline(learningContent),
      targetGroup,
      methodology,
      lifeCycleMonth,
      preTest: "-",
      postTest: "-",
      functionCode: "",
      functionName: "",
      positions: "",
      levels: "",
    });
  }

  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let rows: CourseMasterImportRow[] = [];

    if (fileName.endsWith(".xlsx")) {
      rows = parseXlsxBuffer(buffer);
    } else {
      const text = buffer.toString("utf8");
      rows = parseCsvText(text);
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      rowCount: rows.length,
      rows,
    });
  } catch (error) {
    console.error("Parse template error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to parse file" },
      { status: 500 },
    );
  }
}
