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
