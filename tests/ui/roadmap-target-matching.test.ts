import { describe, expect, it } from "vitest";
import { normalizeEmployeeLevel } from "../../app/lib/employeeMasterData";

const normalizePosition = (val: string): string => {
  if (!val) return "";
  const t = val.trim().toLowerCase().replace(/[\.\-_]/g, " ").replace(/\s+/g, " ");
  if (/general\s*manager|ผู้จัดการทั่วไป|ผู้จัดการฝ่าย|gm\b/.test(t)) return "general manager";
  if (/assistant\s*manager|asst\s*manager|ผู้ช่วยผู้จัดการ/.test(t)) return "assistant manager";
  if (/plant\s*manager|ผู้จัดการโรงงาน/.test(t)) return "plant manager";
  if (/section\s*head|หัวหน้างาน|หัวหน้าแผนก|ผู้จัดการแผนก|supervisor|sh\b/.test(t)) return "section head";
  if (/senior\s*foreman|หัวหน้าชุดอาวุโส/.test(t)) return "senior foreman";
  if (/foreman|หัวหน้าชุด|force\s*man/.test(t)) return "foreman";
  if (/leader|หัวหน้ากลุ่ม|หัวหน้ากะ/.test(t)) return "leader";
  if (/manager|ผู้จัดการ/.test(t)) return "manager";
  if (/officer|เจ้าหน้าที่|office\b/.test(t)) return "officer";
  if (/engineer|วิศวกร/.test(t)) return "engineer";
  if (/technician|ช่างเทคนิค|ช่าง/.test(t)) return "technician";
  if (/operator|พนักงานปฏิบัติการ|คนงาน/.test(t)) return "operator";
  if (/staff|พนักงาน/.test(t)) return "staff";
  if (/president|ประธาน/.test(t)) return "president";
  if (/vice\s*president|รองประธาน/.test(t)) return "vice president";
  if (/advisor|ที่ปรึกษา/.test(t)) return "advisor";
  return t;
};

const isTargetMatch = (
  targets: readonly string[] | undefined,
  userValues: string | string[],
  isLevel = false,
  isPosition = false,
) => {
  const userVals = (Array.isArray(userValues) ? userValues : [userValues])
    .map((v) => (v || "").trim())
    .filter((v) => v && v !== "-");

  if (userVals.length === 0) return false;
  if (!targets || targets.length === 0) return false;

  return targets.some((target) => {
    const t = target.trim().toLowerCase();
    if (!t || t === "-") return false;

    if (
      t === "all" ||
      t === "all function" ||
      t === "all companies" ||
      t === "all positions" ||
      t === "all levels" ||
      t === "ทุกตำแหน่ง" ||
      t === "ทุกระดับ" ||
      t === "ทุกกลุ่ม" ||
      t === "พนักงานทุกกลุ่ม" ||
      t === "พนักงานทุกคน"
    ) {
      return true;
    }

    const targetNorm = isLevel
      ? normalizeEmployeeLevel(target)
      : isPosition
      ? normalizePosition(target)
      : target.trim().toLowerCase();

    return userVals.some((rawUser) => {
      const normalizedUser = isLevel
        ? normalizeEmployeeLevel(rawUser)
        : isPosition
        ? normalizePosition(rawUser)
        : rawUser.trim().toLowerCase();

      return (
        Boolean(targetNorm && normalizedUser && targetNorm === normalizedUser) ||
        Boolean(targetNorm && normalizedUser && (targetNorm.includes(normalizedUser) || normalizedUser.includes(targetNorm))) ||
        target.trim().toLowerCase() === rawUser.trim().toLowerCase() ||
        target.trim().toLowerCase().includes(rawUser.trim().toLowerCase()) ||
        rawUser.trim().toLowerCase().includes(target.trim().toLowerCase())
      );
    });
  });
};

type Employee = {
  company: string;
  functionName: string;
  position: string;
  level: string;
};

type RoadmapCourse = {
  courseOwner: "CENTER" | "FACTORY";
  ownerCompany: string;
  targetCompanies: string[];
  targetFunctions: string[];
  targetPositions: string[];
  targetLevels: string[];
};

function getRoadmapTargetMatchCategory(course: RoadmapCourse, emp: Employee): "DIRECT_MATCH" | "LEVEL_MATCH" | "POSITION_MATCH" | "GENERAL" | "OUT" {
  const isCenter = course.courseOwner === "CENTER";

  // 1. Company
  const isCompanyTargeted = isCenter
    ? course.targetCompanies.length === 0 || course.targetCompanies.includes("ALL") || course.targetCompanies.includes("All Companies") || course.targetCompanies.includes(emp.company)
    : course.ownerCompany === emp.company || course.targetCompanies.includes(emp.company);
  if (!isCompanyTargeted) return "OUT";

  // 2. Function
  const isAllFunction =
    course.targetFunctions.length === 0 ||
    course.targetFunctions.some((f) => /all|ทุกฝ่ายงาน/i.test(f.trim()));
  const matchFunction = isAllFunction || course.targetFunctions.some((f) =>
    emp.functionName.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(emp.functionName.toLowerCase())
  );
  if (!matchFunction) return "OUT";

  // 3. Checklist Position & Level
  const hasPositions = course.targetPositions.length > 0 && !course.targetPositions.every((p) => /^(all|all positions|ทุกตำแหน่ง|-)$/i.test(p.trim()));
  const hasLevels = course.targetLevels.length > 0 && !course.targetLevels.every((l) => /^(all|all levels|ทุกระดับ|-)$/i.test(l.trim()));

  const matchPosition = hasPositions && isTargetMatch(course.targetPositions, [emp.position], false, true);
  const matchLevel = hasLevels && isTargetMatch(course.targetLevels, [emp.level], true, false);

  if (hasPositions && hasLevels) {
    if (matchPosition && matchLevel) return "DIRECT_MATCH";
    if (matchLevel && !matchPosition) return "LEVEL_MATCH";
    if (matchPosition && !matchLevel) return "POSITION_MATCH";
    return "OUT";
  }
  if (hasPositions) {
    return matchPosition ? "DIRECT_MATCH" : "OUT";
  }
  if (hasLevels) {
    return matchLevel ? "DIRECT_MATCH" : "OUT";
  }

  return "GENERAL";
}

describe("Roadmap Checklist Position and Checklist Level Target Matching", () => {
  const courseSectionHeadS3S4: RoadmapCourse = {
    courseOwner: "FACTORY",
    ownerCompany: "ATA",
    targetCompanies: ["ATA"],
    targetFunctions: ["Production"],
    targetPositions: ["Section Head", "หัวหน้างาน"],
    targetLevels: ["S3", "S4"],
  };

  it("labels 'DIRECT_MATCH' (ตรงกลุ่มเป้าหมาย) when both checklist position AND level match", () => {
    const empSectionHeadS3: Employee = {
      company: "ATA",
      functionName: "Production",
      position: "Section Head",
      level: "S3",
    };
    expect(getRoadmapTargetMatchCategory(courseSectionHeadS3S4, empSectionHeadS3)).toBe("DIRECT_MATCH");
  });

  it("labels 'LEVEL_MATCH' (ตรงกับ Level) when level matches but position does not", () => {
    const empEngineerS3: Employee = {
      company: "ATA",
      functionName: "Production",
      position: "Engineer", // Not Section Head
      level: "S3",          // Matches S3
    };
    expect(getRoadmapTargetMatchCategory(courseSectionHeadS3S4, empEngineerS3)).toBe("LEVEL_MATCH");
  });

  it("labels 'POSITION_MATCH' (ตรงกับ Position) when position matches but level does not", () => {
    const empSectionHeadS2: Employee = {
      company: "ATA",
      functionName: "Production",
      position: "Section Head", // Matches Section Head
      level: "S2",              // Not S3 or S4
    };
    expect(getRoadmapTargetMatchCategory(courseSectionHeadS3S4, empSectionHeadS2)).toBe("POSITION_MATCH");
  });

  it("labels 'OUT' when company or function does not match", () => {
    const empITSectionHeadS3: Employee = {
      company: "ATA",
      functionName: "IT",
      position: "Section Head",
      level: "S3",
    };
    expect(getRoadmapTargetMatchCategory(courseSectionHeadS3S4, empITSectionHeadS3)).toBe("OUT");
  });

  it("labels 'GENERAL' (หลักสูตรทั่วไป) when course does not restrict position or level", () => {
    const courseGeneral: RoadmapCourse = {
      courseOwner: "CENTER",
      ownerCompany: "CENTER",
      targetCompanies: ["All Companies"],
      targetFunctions: ["All Function"],
      targetPositions: [],
      targetLevels: [],
    };

    const empStaffO1: Employee = {
      company: "ATA",
      functionName: "Production",
      position: "Staff",
      level: "O1",
    };
    expect(getRoadmapTargetMatchCategory(courseGeneral, empStaffO1)).toBe("GENERAL");
  });
});
