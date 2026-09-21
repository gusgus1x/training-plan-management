/**
 * Level parsing shared by the screens that sort or match employees by grade.
 *
 * This file used to generate 450 fake employees - six companies of 75, with invented Thai names
 * and invented national-id numbers - and hand them out through readEmployeeMasterData() as a
 * runtime fallback whenever the employees API came back empty. That fed the printed attendance
 * sheet, so a roster of people who do not exist could be exported as a real document. The caller
 * was removed with the rest of the fake-success work; the generator is now gone too.
 *
 * Employees come from /api/master-data/employees. There is no local fallback, by design: an empty
 * list means the request failed and the screen should say so, not invent names.
 */
export type EmployeeCompanyCode = "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

export type EmployeeMasterRecord = {
  id: string;
  company: EmployeeCompanyCode;
  empCode: string;
  idCard: string;
  nameTh: string;
  surnameTh: string;
  titleEn: string;
  nameEn: string;
  surnameEn: string;
  birthday: string;
  workday: string;
  functionCode: string;
  functionName: string;
  department?: string;
  positionName: string;
  levelKey: string;
};

export const normalizeEmployeeLevel = (levelKey: string | null | undefined) => {
  if (!levelKey) return "";
  const raw = String(levelKey).trim().toUpperCase();
  const clean = raw.replace(/[\s\.\-_]/g, "");

  const matchCode = raw.match(/(M[1-4]|S[1-4]|O[1-5]|L[1-5]|[จบป][1-5])/i);
  if (matchCode) {
    const code = matchCode[1].toUpperCase();
    return code
      .replace(/^จ/, "M")
      .replace(/^บ/, "S")
      .replace(/^ป/, "O")
      .replace(/^L/, "O");
  }

  const thaiFullMatch = clean.match(/^(จัดการ|บังคับบัญชา|ปฏิบัติการ)(\d+)$/);
  if (thaiFullMatch) {
    const prefixMap: Record<string, string> = { จัดการ: "M", บังคับบัญชา: "S", ปฏิบัติการ: "O" };
    return `${prefixMap[thaiFullMatch[1]] || ""}${thaiFullMatch[2]}`;
  }

  const engFullMatch = clean.match(/^(MANAGEMENT|SUPERVISOR|OPERATOR)(\d+)$/);
  if (engFullMatch) {
    const prefixMap: Record<string, string> = { MANAGEMENT: "M", SUPERVISOR: "S", OPERATOR: "O" };
    return `${prefixMap[engFullMatch[1]] || ""}${engFullMatch[2]}`;
  }

  return clean
    .replace(/^จ/, "M")
    .replace(/^บ/, "S")
    .replace(/^ป/, "O")
    .replace(/^L(?=\d)/, "O");
};

export const getLevelRank = (levelKey: string): number => {
  if (!levelKey) return 0;
  const raw = levelKey.trim();

  // Management (จ, M):
  if (/จ\s*4|M\s*4|management\s*4/i.test(raw)) return 13;
  if (/จ\s*3|M\s*3|management\s*3/i.test(raw)) return 12;
  if (/จ\s*2|M\s*2|management\s*2/i.test(raw)) return 11;
  if (/จ\s*1|M\s*1|management\s*1/i.test(raw)) return 10;

  // Supervisor / Specialist (บ, S):
  if (/บ\s*4|S\s*4|supervisor\s*4/i.test(raw)) return 9;
  if (/บ\s*3|S\s*3|supervisor\s*3/i.test(raw)) return 8;
  if (/บ\s*2|S\s*2|supervisor\s*2/i.test(raw)) return 7;
  if (/บ\s*1|S\s*1|supervisor\s*1/i.test(raw)) return 6;

  // Operation (ป, O, L):
  if (/ป\s*5|O\s*5|L\s*5|operation\s*5/i.test(raw)) return 5;
  if (/ป\s*4|O\s*4|L\s*4|operation\s*4/i.test(raw)) return 4;
  if (/ป\s*3|O\s*3|L\s*3|operation\s*3/i.test(raw)) return 3;
  if (/ป\s*2|O\s*2|L\s*2|operation\s*2/i.test(raw)) return 2;
  if (/ป\s*1|O\s*1|L\s*1|operation\s*1/i.test(raw)) return 1;

  // Fallback regex match
  const thaiMatch = raw.match(/^([จบป])\s*(\d)$/);
  if (thaiMatch) {
    const code = thaiMatch[1];
    const num = parseInt(thaiMatch[2], 10);
    if (code === "จ") return 9 + num;
    if (code === "บ") return 5 + num;
    if (code === "ป") return num;
  }

  const norm = normalizeEmployeeLevel(raw).toUpperCase();
  const engMatch = norm.match(/^([MSOL])\s*(\d)$/);
  if (engMatch) {
    const code = engMatch[1];
    const num = parseInt(engMatch[2], 10);
    if (code === "M") return 9 + num;
    if (code === "S") return 5 + num;
    if (code === "O" || code === "L") return num;
  }

  return 0;
};

export const SECTION_HEAD_OR_ABOVE_POSITIONS = [
  { rank: 1, code: "PRES", nameTh: "ประธานบริษัท", nameEn: "President" },
  { rank: 2, code: "EVP", nameTh: "รองประธานบริหาร", nameEn: "Executive Vice President" },
  { rank: 3, code: "VP", nameTh: "รองประธาน", nameEn: "Vice President" },
  { rank: 4, code: "SADV", nameTh: "ที่ปรึกษาอาวุโส", nameEn: "Senior Advisor" },
  { rank: 5, code: "ADV", nameTh: "ที่ปรึกษา", nameEn: "Advisor" },
  { rank: 6, code: "SEC", nameTh: "ผู้ประสานงานบริหารอาวุโส", nameEn: "Senior Executive Coordinator" },
  { rank: 7, code: "PM", nameTh: "ผู้จัดการโรงงาน", nameEn: "Plant Manager" },
  { rank: 8, code: "EGM", nameTh: "ผู้จัดการทั่วไปฝ่ายบริหาร", nameEn: "Executive General Manager" },
  { rank: 9, code: "SGM", nameTh: "ผู้จัดการทั่วไปอาวุโส", nameEn: "Senior General Manager" },
  { rank: 10, code: "GM", nameTh: "ผู้จัดการทั่วไป", nameEn: "General Manager" },
  { rank: 11, code: "MGR", nameTh: "ผู้จัดการ", nameEn: "Manager" },
  { rank: 12, code: "SH", nameTh: "ผู้จัดการแผนก", nameEn: "Section Head" },
] as const;

export const SECTION_HEAD_OR_ABOVE_CODES = [
  "PRES",
  "EVP",
  "VP",
  "SADV",
  "ADV",
  "SEC",
  "PM",
  "EGM",
  "SGM",
  "GM",
  "MGR",
  "SH",
] as const;

export const SECTION_HEAD_OR_ABOVE_TITLES_TH = [
  "ประธานบริษัท",
  "รองประธานบริหาร",
  "รองประธาน",
  "ที่ปรึกษาอาวุโส",
  "ที่ปรึกษา",
  "ผู้ประสานงานบริหารอาวุโส",
  "ผู้จัดการโรงงาน",
  "ผู้จัดการทั่วไปฝ่ายบริหาร",
  "ผู้จัดการทั่วไปอาวุโส",
  "ผู้จัดการทั่วไป",
  "ผู้จัดการแผนก",
  "ผู้จัดการ",
  "หัวหน้าแผนก",
  "ผู้อำนวยการ",
  "กรรมการผู้จัดการ",
  "ประธาน",
] as const;

export const SECTION_HEAD_OR_ABOVE_TITLES_EN = [
  "president",
  "executive vice president",
  "vice president",
  "senior advisor",
  "advisor",
  "senior executive coordinator",
  "plant manager",
  "executive general manager",
  "senior general manager",
  "general manager",
  "manager",
  "section head",
  "sectionhead",
  "director",
] as const;

export const HIERARCHY_19_RANKS = [
  { rank: 1, code: "PRES", nameTh: "ประธานบริษัท", nameEn: "President" },
  { rank: 2, code: "EVP", nameTh: "รองประธานบริหาร", nameEn: "Executive Vice President" },
  { rank: 3, code: "VP", nameTh: "รองประธาน", nameEn: "Vice President" },
  { rank: 4, code: "SADV", nameTh: "ที่ปรึกษาอาวุโส", nameEn: "Senior Advisor" },
  { rank: 5, code: "ADV", nameTh: "ที่ปรึกษา", nameEn: "Advisor" },
  { rank: 6, code: "SEC", nameTh: "ผู้ประสานงานบริหารอาวุโส", nameEn: "Senior Executive Coordinator" },
  { rank: 7, code: "PM", nameTh: "ผู้จัดการโรงงาน", nameEn: "Plant Manager" },
  { rank: 8, code: "EGM", nameTh: "ผู้จัดการทั่วไปฝ่ายบริหาร", nameEn: "Executive General Manager" },
  { rank: 9, code: "SGM", nameTh: "ผู้จัดการทั่วไปอาวุโส", nameEn: "Senior General Manager" },
  { rank: 10, code: "GM", nameTh: "ผู้จัดการทั่วไป", nameEn: "General Manager" },
  { rank: 11, code: "MGR", nameTh: "ผู้จัดการ", nameEn: "Manager" },
  { rank: 12, code: "SH", nameTh: "ผู้จัดการแผนก", nameEn: "Section Head" },
  { rank: 13, code: "ENG", nameTh: "วิศวกร", nameEn: "Engineer" },
  { rank: 14, code: "OFF", nameTh: "เจ้าหน้าที่", nameEn: "Officer" },
  { rank: 15, code: "SFM", nameTh: "ซีเนียร์โฟร์แมน", nameEn: "Senior Foreman" },
  { rank: 16, code: "FM", nameTh: "โฟร์แมน", nameEn: "Foreman" },
  { rank: 17, code: "LD", nameTh: "ลีดเดอร์", nameEn: "Leader" },
  { rank: 18, code: "STAFF", nameTh: "พนักงาน", nameEn: "Staff" },
  { rank: 19, code: "OP", nameTh: "พนักงานปฏิบัติการ", nameEn: "Operator" },
] as const;

export const getSectionHeadOrAboveRank = (item: {
  positionCode?: string | null;
  positionName?: string | null;
  levelCode?: string | null;
  levelKey?: string | null;
  levelName?: string | null;
}): number => {
  const code = (item.positionCode || "").trim().toUpperCase();
  const name = (item.positionName || "").trim().toLowerCase();

  if (code === "PRES" || name.includes("ประธานบริษัท") || name === "president") return 1;
  if (code === "EVP" || name.includes("รองประธานบริหาร") || name.includes("executive vice president")) return 2;
  if (code === "VP" || name.includes("รองประธาน") || name.includes("vice president")) return 3;
  if (code === "SADV" || name.includes("ที่ปรึกษาอาวุโส") || name.includes("senior advisor")) return 4;
  if (code === "ADV" || name.includes("ที่ปรึกษา") || name.includes("advisor")) return 5;
  if (code === "SEC" || name.includes("ผู้ประสานงานบริหารอาวุโส") || name.includes("senior executive coordinator")) return 6;
  if (code === "PM" || name.includes("ผู้จัดการโรงงาน") || name.includes("plant manager")) return 7;
  if (code === "EGM" || name.includes("ผู้จัดการทั่วไปฝ่ายบริหาร") || name.includes("executive general manager")) return 8;
  if (code === "SGM" || name.includes("ผู้จัดการทั่วไปอาวุโส") || name.includes("senior general manager")) return 9;
  if (code === "GM" || name.includes("ผู้จัดการทั่วไป") || name.includes("general manager")) return 10;
  if (code === "MGR" || name.includes("ผู้จัดการ") || name.includes("manager")) return 11;
  if (code === "SH" || name.includes("ผู้จัดการแผนก") || name.includes("หัวหน้าแผนก") || name.includes("section head") || name.includes("sectionhead")) return 12;

  return 99;
};

export const getEmployee19Rank = (item: {
  positionCode?: string | null;
  positionName?: string | null;
  levelCode?: string | null;
  levelKey?: string | null;
  levelName?: string | null;
}): number => {
  // First check Section Head and higher (ranks 1-12)
  const shRank = getSectionHeadOrAboveRank(item);
  if (shRank >= 1 && shRank <= 12) {
    return shRank;
  }

  const code = (item.positionCode || "").trim().toUpperCase();
  const name = (item.positionName || "").trim().toLowerCase();

  // Check ranks 13-19 by code
  if (code === "ENG") return 13;
  if (code === "OFF") return 14;
  if (code === "SFM") return 15;
  if (code === "FM") return 16;
  if (code === "LD") return 17;
  if (code === "STAFF") return 18;
  if (code === "OP") return 19;

  // Check ranks 13-19 by name (Thai & English)
  if (name.includes("วิศวกร") || name.includes("engineer")) return 13;
  if (name.includes("เจ้าหน้าที่") || name.includes("officer")) return 14;
  if (name.includes("ซีเนียร์โฟร์แมน") || name.includes("senior foreman") || name.includes("หัวหน้าชุดอาวุโส")) return 15;
  if (name.includes("โฟร์แมน") || name.includes("foreman") || name.includes("หัวหน้าชุด")) return 16;
  if (name.includes("ลีดเดอร์") || name.includes("leader")) return 17;
  if (name.includes("พนักงานปฏิบัติการ") || name.includes("operator")) return 19;
  if (name.includes("พนักงาน") || name.includes("staff") || name.includes("ช่างเทคนิค") || name.includes("technician")) return 18;

  // Level fallbacks if available
  const lvlRaw = (item.levelKey || item.levelCode || item.levelName || "").trim();
  if (lvlRaw) {
    const lvlNorm = normalizeEmployeeLevel(lvlRaw).toUpperCase();
    if (lvlNorm.startsWith("M") || lvlRaw.startsWith("จ") || lvlRaw.includes("จัดการ")) return 12;
    if (lvlNorm.startsWith("S") || lvlRaw.startsWith("บ") || lvlRaw.includes("บังคับบัญชา")) {
      const rank = getLevelRank(lvlRaw);
      return rank >= 8 ? 15 : 16;
    }
    if (lvlNorm.startsWith("O") || lvlNorm.startsWith("L") || lvlRaw.startsWith("ป") || lvlRaw.includes("ปฏิบัติการ")) {
      const rank = getLevelRank(lvlRaw);
      if (rank >= 4) return 17;
      if (rank >= 2) return 18;
      return 19;
    }
  }

  return 18; // Default to Staff
};

/**
 * Returns the exact direct superior rank according to Option 1:
 * - Rank 13-19 (lower than Section Head) -> Rank 12 (Section Head)
 * - Rank 12 (Section Head) -> Rank 11 (Manager)
 * - Rank 11 (Manager) -> Rank 10 (General Manager)
 * - Rank 10 (General Manager) -> Rank 9 (Senior General Manager)
 * - Rank R <= 9 down to 2 -> Direct superior rank R - 1
 * - Rank 1 (President) -> 1 (Auto-approve)
 */
export const getTargetApproverRank = (requesterRank: number): number => {
  if (requesterRank <= 1) return 1;
  if (requesterRank > 12) return 12;
  if (requesterRank === 12) return 11;
  if (requesterRank === 11) return 10;
  if (requesterRank === 10) return 9;
  return requesterRank - 1;
};

export const getHierarchyRankInfo = (rank: number) => {
  return HIERARCHY_19_RANKS.find((r) => r.rank === rank) || null;
};


export const isSectionHeadOrAbove = (user: {
  role?: string | null;
  roleCode?: string | null;
  positionCode?: string | null;
  positionName?: string | null;
  position?: string | null;
  levelCode?: string | null;
  levelName?: string | null;
  level?: string | null;
  levelKey?: string | null;
} | null | undefined): boolean => {
  if (!user) return false;

  const role = (user.roleCode || user.role || "").toUpperCase();
  if (role === "HRD_CENTER" || role === "HRD_FACTORY" || role === "ADMIN") {
    return true;
  }

  // 1. Check position code against all 12 positions
  const posCode = (user.positionCode || "").trim().toUpperCase();
  if (SECTION_HEAD_OR_ABOVE_CODES.some((c) => c === posCode)) {
    return true;
  }

  // 2. Check position name (Thai & English)
  const posName = (user.positionName || user.position || "").trim().toLowerCase();
  if (posName) {
    if (
      SECTION_HEAD_OR_ABOVE_TITLES_EN.some((term) => posName.includes(term)) ||
      SECTION_HEAD_OR_ABOVE_TITLES_TH.some((term) => posName.includes(term.toLowerCase()))
    ) {
      return true;
    }
  }

  // 3. Check level (Management level M1-M4 / จ1-จ4)
  const lvlRaw = (user.levelKey || user.levelCode || user.level || user.levelName || "").trim();
  if (lvlRaw) {
    const lvlNorm = normalizeEmployeeLevel(lvlRaw).toUpperCase();
    if (lvlNorm.startsWith("M") || lvlRaw.startsWith("จ") || lvlRaw.includes("จัดการ")) {
      return true;
    }
    const rank = getLevelRank(lvlRaw);
    if (rank >= 10) {
      return true;
    }
  }

  return false;
};

export const THAI_TO_EN_POSITIONS: Record<string, string> = {
  "ผู้จัดการโรงงาน": "Plant Manager",
  "ประธานบริษัท": "President",
  "ประธาน": "President",
  "รองประธานบริหาร": "Executive Vice President",
  "รองประธาน": "Vice President",
  "ที่ปรึกษาอาวุโส": "Senior Advisor",
  "ที่ปรึกษา": "Advisor",
  "ผู้ประสานงานบริหารอาวุโส": "Senior Executive Coordinator",
  "ผู้จัดการทั่วไปฝ่ายบริหาร": "Executive General Manager",
  "ผู้จัดการทั่วไปอาวุโส": "Senior General Manager",
  "ผู้จัดการทั่วไป": "General Manager",
  "ผู้จัดการ": "Manager",
  "ผู้จัดการ++": "Manager++",
  "ผู้จัดการฝ่าย": "General Manager",
  "ผู้จัดการแผนก": "Section Head",
  "หัวหน้าแผนก": "Section Head",
  "หัวหน้างาน": "Section Head",
  "ผู้อำนวยการ": "Director",
  "กรรมการผู้จัดการ": "Managing Director",
  "เจ้าหน้าที่": "Officer",
  "เจ้าหน้าที่อาวุโส": "Senior Officer",
  "พนักงาน": "Staff",
  "พนักงานปฏิบัติการ": "Operator",
  "พนักงานขับรถ": "Driver",
  "วิศวกร": "Engineer",
  "วิศวกรอาวุโส": "Senior Engineer",
  "ช่างเทคนิค": "Technician",
  "ช่างเทคนิคอาวุโส": "Senior Technician",
  "โฟร์แมน": "Foreman",
  "หัวหน้าชุด": "Foreman",
  "หัวหน้าชุดอาวุโส": "Senior Foreman",
  "ลีดเดอร์": "Leader",
  "ผู้ช่วยผู้จัดการ": "Assistant Manager",
  "ผู้ช่วยผู้จัดการแผนก": "Assistant Section Head",
  "ผู้จัดการบริหารทั่วไป": "General Administration Manager",
};

export const toEnglishPositionName = (
  position?:
    | {
        position_code?: string | null;
        position_name_en?: string | null;
        position_name_th?: string | null;
      }
    | string
    | null,
): string => {
  if (!position) return "-";
  if (typeof position === "object") {
    if (position.position_name_en?.trim()) return position.position_name_en.trim();
    const th = position.position_name_th?.trim() || "";
    if (th && THAI_TO_EN_POSITIONS[th]) return THAI_TO_EN_POSITIONS[th];
    if (position.position_code?.trim()) {
      const code = position.position_code.trim().toUpperCase();
      const matched = SECTION_HEAD_OR_ABOVE_POSITIONS.find((p) => p.code === code);
      if (matched) return matched.nameEn;
      return code;
    }
    if (th) {
      for (const [thKey, enVal] of Object.entries(THAI_TO_EN_POSITIONS)) {
        if (th.includes(thKey)) return enVal;
      }
      return th;
    }
    return "-";
  }

  const str = String(position).trim();
  if (!str) return "-";
  if (THAI_TO_EN_POSITIONS[str]) return THAI_TO_EN_POSITIONS[str];
  for (const [thKey, enVal] of Object.entries(THAI_TO_EN_POSITIONS)) {
    if (str.includes(thKey)) return enVal;
  }
  return str;
};

