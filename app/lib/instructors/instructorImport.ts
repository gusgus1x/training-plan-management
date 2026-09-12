import zlib from "zlib";

export type InstructorImportRow = {
  rowNum: number;
  instructorCode: string;
  firstName: string;
  lastName: string;
  telephone: string | null;
  email: string | null;
  education: string | null;
  university: string | null;
  organizationName: string | null;
  status: "ACTIVE" | "INACTIVE";
  isValid: boolean;
  errors: string[];
  dbStatus?: "NEW" | "UPDATE" | "ERROR";
  existingInstructorId?: string | null;
};

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

export function parseInstructorXlsxBuffer(buffer: Buffer): InstructorImportRow[] {
  const entries: Record<string, string> = {};
  let offset = 0;

  while (offset < buffer.length - 4) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

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

  // Find header row (usually Row 1 or first row with code/name/instructor headers)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const vals = Object.values(rawRows[i].cells).map((v) => v.toLowerCase());
    if (
      vals.some(
        (v) =>
          v.includes("code") ||
          v.includes("รหัส") ||
          v.includes("ชื่อ") ||
          v.includes("name") ||
          v.includes("instructor") ||
          v.includes("วิทยากร"),
      )
    ) {
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
    // 1. Exact match
    for (const [col, h] of Object.entries(colToHeader)) {
      if (keys.some((k) => h === k.toLowerCase())) return col;
    }
    // 2. Contains match
    for (const [col, h] of Object.entries(colToHeader)) {
      if (keys.some((k) => h.includes(k.toLowerCase()))) return col;
    }
    return null;
  };

  const codeCol = findCol("รหัสวิทยากร", "instructor code", "instructor_code", "รหัส");
  const firstCol = findCol("ชื่อ", "first name", "firstname", "first_name", "ชื่อวิทยากร", "fname");
  const lastCol = findCol("นามสกุล", "last name", "lastname", "last_name", "นามสกุลวิทยากร", "lname");
  const phoneCol = findCol("เบอร์โทรศัพท์", "เบอร์โทร", "telephone", "phone", "tel", "mobile");
  const emailCol = findCol("อีเมล", "email", "mail", "e-mail");
  const eduCol = findCol("ระดับการศึกษา", "วุฒิการศึกษา", "วุฒิ", "education", "degree");
  const uniCol = findCol("มหาวิทยาลัย", "university", "institute", "สถาบันการศึกษา");
  const orgCol = findCol("หน่วยงาน", "สังกัด", "organization", "company", "org", "บริษัท");
  const statusCol = findCol("สถานะ", "status");

  const rows: InstructorImportRow[] = [];
  const seenCodes = new Set<string>();

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const cells = rawRows[i].cells;
    const instructorCode = codeCol && cells[codeCol] ? cells[codeCol].trim() : "";
    const firstName = firstCol && cells[firstCol]
      ? cells[firstCol].trim()
      : (codeCol ? cells["B"] || "" : cells["A"] || "").trim();
    const lastName = lastCol && cells[lastCol]
      ? cells[lastCol].trim()
      : (codeCol ? cells["C"] || "" : cells["B"] || "").trim();
    const telephone = (phoneCol && cells[phoneCol]) ? cells[phoneCol].trim() : (codeCol ? cells["D"] || null : cells["C"] || null);
    const email = (emailCol && cells[emailCol]) ? cells[emailCol].trim() : (codeCol ? cells["E"] || null : cells["D"] || null);
    const education = (eduCol && cells[eduCol]) ? cells[eduCol].trim() : (codeCol ? cells["F"] || null : cells["E"] || null);
    const university = (uniCol && cells[uniCol]) ? cells[uniCol].trim() : (codeCol ? cells["G"] || null : cells["F"] || null);
    const organizationName = (orgCol && cells[orgCol]) ? cells[orgCol].trim() : (codeCol ? cells["H"] || null : cells["G"] || null);
    const rawStatus = statusCol && cells[statusCol] ? cells[statusCol].trim().toUpperCase() : "";

    // Skip blank rows
    if (!instructorCode && !firstName && !lastName) continue;
    // Skip if repeated header
    if ((firstName.toLowerCase().includes("first name") || firstName.toLowerCase().includes("ชื่อ")) &&
        (lastName.toLowerCase().includes("last name") || lastName.toLowerCase().includes("นามสกุล"))) continue;

    const errors: string[] = [];
    if (!firstName) errors.push("ไม่พบชื่อวิทยากร (First Name is required)");
    if (!lastName) errors.push("ไม่พบนามสกุลวิทยากร (Last Name is required)");

    if (instructorCode) {
      const norm = instructorCode.toUpperCase();
      if (seenCodes.has(norm)) {
        errors.push(`รหัสวิทยากร ${instructorCode} ซ้ำกับแถวอื่นในไฟล์`);
      } else {
        seenCodes.add(norm);
      }
    }

    const status: "ACTIVE" | "INACTIVE" =
      rawStatus.includes("INACTIVE") || rawStatus.includes("ไม่ใช้งาน")
        ? "INACTIVE"
        : "ACTIVE";

    rows.push({
      rowNum: rawRows[i].rNum,
      instructorCode: instructorCode ? instructorCode.toUpperCase() : "",
      firstName,
      lastName,
      telephone: telephone || null,
      email: email || null,
      education: education || null,
      university: university || null,
      organizationName: organizationName || null,
      status,
      isValid: errors.length === 0,
      errors,
    });
  }

  return rows;
}

export function parseInstructorCsvText(text: string): InstructorImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headerCells = parseLine(lines[0]).map((h) => h.toLowerCase());
  const findColIdx = (...keys: string[]) => {
    for (let idx = 0; idx < headerCells.length; idx++) {
      const h = headerCells[idx];
      if (keys.some((k) => h === k.toLowerCase() || h.includes(k.toLowerCase()))) {
        return idx;
      }
    }
    return -1;
  };

  const codeIdx = findColIdx("รหัสวิทยากร", "instructor code", "code", "รหัส");
  const firstIdx = findColIdx("ชื่อ", "first name", "firstname", "first_name");
  const lastIdx = findColIdx("นามสกุล", "last name", "lastname", "last_name");
  const phoneIdx = findColIdx("เบอร์โทรศัพท์", "เบอร์โทร", "telephone", "phone", "tel");
  const emailIdx = findColIdx("อีเมล", "email", "mail");
  const eduIdx = findColIdx("ระดับการศึกษา", "วุฒิการศึกษา", "วุฒิ", "education");
  const uniIdx = findColIdx("มหาวิทยาลัย", "university", "institute");
  const orgIdx = findColIdx("หน่วยงาน", "สังกัด", "organization", "company");
  const statusIdx = findColIdx("สถานะ", "status");

  const rows: InstructorImportRow[] = [];
  const seenCodes = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const hasCodeCol = codeIdx >= 0;

    const instructorCode = hasCodeCol ? (cols[codeIdx] || "").trim() : "";
    const firstName = firstIdx >= 0
      ? (cols[firstIdx] || "").trim()
      : (hasCodeCol ? cols[1] || "" : cols[0] || "").trim();
    const lastName = lastIdx >= 0
      ? (cols[lastIdx] || "").trim()
      : (hasCodeCol ? cols[2] || "" : cols[1] || "").trim();
    const telephone = (phoneIdx >= 0 ? cols[phoneIdx] : (hasCodeCol ? cols[3] : cols[2]) || "").trim() || null;
    const email = (emailIdx >= 0 ? cols[emailIdx] : (hasCodeCol ? cols[4] : cols[3]) || "").trim() || null;
    const education = (eduIdx >= 0 ? cols[eduIdx] : (hasCodeCol ? cols[5] : cols[4]) || "").trim() || null;
    const university = (uniIdx >= 0 ? cols[uniIdx] : (hasCodeCol ? cols[6] : cols[5]) || "").trim() || null;
    const organizationName = (orgIdx >= 0 ? cols[orgIdx] : (hasCodeCol ? cols[7] : cols[6]) || "").trim() || null;
    const rawStatus = statusIdx >= 0 ? (cols[statusIdx] || "").trim().toUpperCase() : "";

    if (!instructorCode && !firstName && !lastName) continue;

    const errors: string[] = [];
    if (!firstName) errors.push("ไม่พบชื่อวิทยากร (First Name is required)");
    if (!lastName) errors.push("ไม่พบนามสกุลวิทยากร (Last Name is required)");

    if (instructorCode) {
      const norm = instructorCode.toUpperCase();
      if (seenCodes.has(norm)) {
        errors.push(`รหัสวิทยากร ${instructorCode} ซ้ำกับแถวอื่นในไฟล์`);
      } else {
        seenCodes.add(norm);
      }
    }

    const status: "ACTIVE" | "INACTIVE" =
      rawStatus.includes("INACTIVE") || rawStatus.includes("ไม่ใช้งาน")
        ? "INACTIVE"
        : "ACTIVE";

    rows.push({
      rowNum: i + 1,
      instructorCode: instructorCode ? instructorCode.toUpperCase() : "",
      firstName,
      lastName,
      telephone,
      email,
      education,
      university,
      organizationName,
      status,
      isValid: errors.length === 0,
      errors,
    });
  }

  return rows;
}
