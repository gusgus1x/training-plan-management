// Client-side Excel & CSV parser and template generator

export interface CourseMasterImportRow {
  rowNum: number;
  courseCode: string;
  courseNameTh: string;
  courseNameEn: string;
  courseGroup: string;
  courseType: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  lifeCycleMonth: string;
  preTest: string;
  postTest: string;
  functionCode: string;
  functionName: string;
  positions: string;
  levels: string;
}

export const downloadCsvTemplate = () => {
  const headers = [
    "Course Code",
    "Course Name(TH)",
    "Course Name(EN)",
    "Objective",
    "Learning Content",
    "Target Group",
    "Methodology",
    "Life Cycle",
    "Course Type",
    "Course Group",
    "Background",
  ];

  const sampleRows = [
    [
      "QT-001",
      "ระบบบริหารงานคุณภาพ ISO 9001:2015",
      "ISO 9001:2015 Quality Management System",
      "เพื่อสร้างความเข้าใจในระบบบริหารงานคุณภาพ ISO 9001:2015",
      "1. ข้อกำหนด ISO 9001 2. การตรวจประเมินภายใน 3. การปรับปรุงอย่างต่อเนื่อง",
      "ระดับ Supervisor และ Engineer ขึ้นไป",
      "Lecture / Workshop",
      "12",
      "IN-HOUSE",
      "Quality",
      "เพื่อให้พนักงานเข้าใจมาตรฐานคุณภาพ ISO 9001 ในกระบวนการทำงาน",
    ],
    [
      "MGT-001",
      "ทักษะการบริหารจัดการและการสื่อสารสำหรับหัวหน้างาน",
      "Supervisory Management & Communication Skills",
      "เพื่อพัฒนาทักษะภาวะผู้นำและการสื่อสารทีมงานอย่างมีประสิทธิภาพ",
      "1. การวางแผนงาน 2. การมอบหมายงาน 3. เทคนิคการจูงใจทีมงาน",
      "ระดับ Supervisor และ Section Head",
      "Workshop / Case Study",
      "24",
      "IN-HOUSE",
      "Management",
      "พัฒนาศักยภาพภาวะผู้นำสำหรับหัวหน้างานที่ได้รับการแต่งตั้งใหม่",
    ],
  ];

  const bom = "\uFEFF";
  const csvContent =
    bom +
    [
      headers.join(","),
      ...sampleRows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "Master_Course_Template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCsvText = (text: string): CourseMasterImportRow[] => {
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

  // Check if header row is at row 0 or row 3 (if multi-header template)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const parsed = parseLine(lines[i]).map((h) => h.toLowerCase());
    if (parsed.some((h) => h.includes("code") || h.includes("subject") || h.includes("course") || h.includes("รหัส"))) {
      headerIndex = i;
      break;
    }
  }

  const rawHeaders = parseLine(lines[headerIndex]);
  const headers = rawHeaders.map((h) => h.toLowerCase());
  const findIdx = (...keys: string[]) => {
    return headers.findIndex((h) => keys.some((k) => h === k.toLowerCase() || h.includes(k.toLowerCase())));
  };

  const codeIdx = findIdx("course code", "code", "รหัสหลักสูตร", "รหัส");
  const nameThIdx = findIdx("course name(th)", "course name (th)", "course name th", "ชื่อหลักสูตร (th)", "ชื่อหลักสูตร ภาษาไทย", "nameth");
  const nameEnIdx = findIdx("course name(en)", "course name (en)", "course name en", "ชื่อหลักสูตร (en)", "ชื่อหลักสูตร ภาษาอังกฤษ", "nameen");
  const courseNameIdx = findIdx("course name", "course", "ชื่อหลักสูตร", "ชื่อคอร์ส");
  
  // For group: ensure it does not match target group
  let groupIdx = findIdx("course group", "กลุ่มหลักสูตร", "หมวดหมู่", "subject");
  if (groupIdx < 0) {
    groupIdx = headers.findIndex((h) => h === "group" || (h.includes("group") && !h.includes("target")));
  }

  const typeIdx = findIdx("course type", "type", "ประเภทหลักสูตร", "ประเภท");
  const lifeIdx = findIdx("life cycle", "life cycle (month)", "life", "อายุการอบรม");
  const bgIdx = findIdx("background", "ที่มา", "ที่มา (background)");
  const objIdx = findIdx("objective", "วัตถุประสงค์");
  const contentIdx = findIdx("learning content", "content", "เนื้อหา", "เนื้อหาหลักสูตร");
  const targetGroupIdx = findIdx("target group", "target", "กลุ่มเป้าหมาย");
  const methodIdx = findIdx("methodology", "วิธีการ");
  const locationIdx = findIdx("location", "สถานที่");
  const posIdx = findIdx("positions", "position", "ตำแหน่ง");
  const lvlIdx = findIdx("levels", "level", "ระดับ");

  // Identify Level Columns (O1..O5, S1..S4, M1..M3)
  const levelColMap: Array<{ colIdx: number; levelName: string }> = [];
  const levelNames = ["O1", "O2", "O3", "O4", "O5", "S1", "S2", "S3", "S4", "M1", "M2", "M3"];
  
  levelNames.forEach((lvl) => {
    const idx = headers.findIndex((h) => h === lvl.toLowerCase() || h === `[lvl] ${lvl.toLowerCase()}`);
    if (idx >= 0) {
      levelColMap.push({ colIdx: idx, levelName: lvl });
    }
  });

  const isSelectedVal = (val: string | undefined): boolean => {
    if (!val) return false;
    const clean = val.trim().toLowerCase();
    return clean === "1" || clean === "x" || clean === "y" || clean === "yes" || clean === "✓" || clean === "true";
  };

  const rows: CourseMasterImportRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (!cells.some(Boolean)) continue;

    const courseCode = codeIdx >= 0 ? cells[codeIdx] || "" : "";
    const courseNameTh = nameThIdx >= 0 && cells[nameThIdx] ? cells[nameThIdx] : (courseNameIdx >= 0 ? cells[courseNameIdx] || "" : cells[1] || "");
    const courseNameEn = nameEnIdx >= 0 && cells[nameEnIdx] ? cells[nameEnIdx] : courseNameTh;
    const subjectGroup = groupIdx >= 0 ? cells[groupIdx] || "General" : "General";
    const courseType = typeIdx >= 0 && cells[typeIdx] ? cells[typeIdx] : "ATA-TC";
    const lifeCycle = lifeIdx >= 0 && cells[lifeIdx] ? cells[lifeIdx] : "0";
    const objective = objIdx >= 0 ? cells[objIdx] || "-" : "-";
    const content = contentIdx >= 0 ? cells[contentIdx] || "-" : "-";
    const targetGroup = targetGroupIdx >= 0 ? cells[targetGroupIdx] || "-" : "-";
    const methodology = methodIdx >= 0 && cells[methodIdx] ? cells[methodIdx] : "Lecture / Workshop";
    const positions = posIdx >= 0 ? cells[posIdx] || "" : "";

    if (!courseNameTh && !courseCode) continue;

    // Collect active levels from 1s in level columns or text level column
    const matchedLevels: string[] = [];
    levelColMap.forEach(({ colIdx, levelName }) => {
      if (isSelectedVal(cells[colIdx])) {
        matchedLevels.push(levelName);
      }
    });

    if (matchedLevels.length === 0 && lvlIdx >= 0 && cells[lvlIdx]) {
      matchedLevels.push(cells[lvlIdx]);
    }

    rows.push({
      rowNum: i + 1,
      courseCode,
      courseNameTh,
      courseNameEn,
      courseGroup: subjectGroup || "General",
      courseType,
      objective,
      learningContent: content,
      targetGroup,
      methodology,
      lifeCycleMonth: lifeCycle,
      preTest: "-",
      postTest: "-",
      functionCode: "",
      functionName: "",
      positions,
      levels: matchedLevels.join(", "),
    });
  }

  return rows;
};
