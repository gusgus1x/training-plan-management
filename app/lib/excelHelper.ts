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
    "Course Name TH",
    "Course Name EN",
    "Course Group",
    "Course Type",
    "Objective",
    "Learning Content",
    "Target Group",
    "Methodology",
    "Life Cycle Month",
    "Pre Test",
    "Post Test",
    "Function Code",
    "Function Name",
    "Positions",
    "Levels",
  ];

  const sampleRows = [
    [
      "QT-001",
      "ระบบบริหารงานคุณภาพ ISO 9001:2015",
      "ISO 9001:2015 Quality Management System",
      "Quality",
      "IN-HOUSE",
      "เพื่อสร้างความเข้าใจในระบบบริหารงานคุณภาพ ISO 9001:2015",
      "1. ข้อกำหนด ISO 9001 2. การตรวจประเมินภายใน 3. การปรับปรุงอย่างต่อเนื่อง",
      "ระดับ Supervisor และ Engineer ขึ้นไป",
      "Lecture / Workshop",
      "12",
      "Yes",
      "Yes",
      "ALL",
      "All Functions",
      "Manager, Supervisor, Engineer",
      "L5, L6, L7",
    ],
    [
      "MGT-001",
      "ทักษะการบริหารจัดการและการสื่อสารสำหรับหัวหน้างาน",
      "Supervisory Management & Communication Skills",
      "Management",
      "IN-HOUSE",
      "เพื่อพัฒนาทักษะภาวะผู้นำและการสื่อสารทีมงาน",
      "1. การวางแผนงาน 2. การมอบหมายงาน 3. เทคนิคการจูงใจ",
      "ระดับ Supervisor และ Section Head",
      "Workshop / Case Study",
      "24",
      "No",
      "Yes",
      "MFG",
      "Manufacturing",
      "Supervisor, Section Head",
      "L6, L7",
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
  link.setAttribute("download", "Course_Master_Import_Template.csv");
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

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const findIdx = (...keys: string[]) => {
    return headers.findIndex((h) => keys.some((k) => h.includes(k.toLowerCase())));
  };

  const codeIdx = findIdx("course code", "รหัสหลักสูตร", "code");
  const nameThIdx = findIdx("course name th", "ชื่อหลักสูตร (th)", "ชื่อหลักสูตร ภาษาไทย", "nameth");
  const nameEnIdx = findIdx("course name en", "ชื่อหลักสูตร (en)", "ชื่อหลักสูตร ภาษาอังกฤษ", "nameen");
  const groupIdx = findIdx("group", "กลุ่มหลักสูตร");
  const typeIdx = findIdx("type", "ประเภทหลักสูตร");
  const objIdx = findIdx("objective", "วัตถุประสงค์");
  const contentIdx = findIdx("content", "เนื้อหา");
  const targetIdx = findIdx("target", "กลุ่มเป้าหมาย");
  const methodIdx = findIdx("methodology", "วิธีการ");
  const lifeIdx = findIdx("life", "อายุการอบรม");
  const preIdx = findIdx("pre test", "pretest");
  const postIdx = findIdx("post test", "posttest");
  const fnCodeIdx = findIdx("function code", "รหัสหน่วยงาน");
  const fnNameIdx = findIdx("function name", "ชื่อหน่วยงาน");
  const posIdx = findIdx("positions", "ตำแหน่ง");
  const lvlIdx = findIdx("levels", "ระดับ");

  const rows: CourseMasterImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (!cells.some(Boolean)) continue;

    rows.push({
      rowNum: i + 1,
      courseCode: codeIdx >= 0 ? cells[codeIdx] || "" : "",
      courseNameTh: nameThIdx >= 0 ? cells[nameThIdx] || "" : cells[0] || "",
      courseNameEn: nameEnIdx >= 0 ? cells[nameEnIdx] || "" : "",
      courseGroup: groupIdx >= 0 ? cells[groupIdx] || "" : "General",
      courseType: typeIdx >= 0 ? cells[typeIdx] || "" : "IN-HOUSE",
      objective: objIdx >= 0 ? cells[objIdx] || "" : "-",
      learningContent: contentIdx >= 0 ? cells[contentIdx] || "" : "-",
      targetGroup: targetIdx >= 0 ? cells[targetIdx] || "" : "-",
      methodology: methodIdx >= 0 ? cells[methodIdx] || "" : "Lecture / Workshop",
      lifeCycleMonth: lifeIdx >= 0 ? cells[lifeIdx] || "0" : "0",
      preTest: preIdx >= 0 ? cells[preIdx] || "" : "-",
      postTest: postIdx >= 0 ? cells[postIdx] || "" : "-",
      functionCode: fnCodeIdx >= 0 ? cells[fnCodeIdx] || "" : "",
      functionName: fnNameIdx >= 0 ? cells[fnNameIdx] || "" : "",
      positions: posIdx >= 0 ? cells[posIdx] || "" : "",
      levels: lvlIdx >= 0 ? cells[lvlIdx] || "" : "",
    });
  }

  return rows;
};
