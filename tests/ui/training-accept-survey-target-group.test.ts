import { describe, expect, it } from "vitest";
import { normalizeEmployeeLevel } from "../../app/lib/employeeMasterData";

const normalizeTargetPosition = (position: string) => {
  const normalized = (position || "").trim().toLowerCase().replace(/[\.\-_]/g, " ").replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    sh: "section head",
    office: "supervisor",
    "manager up": "manager",
    "manager++": "manager",
    "force man": "foreman",
    asst: "assistant",
    "asst manager": "assistant manager",
    "asst. manager": "assistant manager",
  };
  return aliases[normalized] ?? normalized;
};

type SurveyEmployee = {
  id: string;
  company: string;
  departmentCode: string | null;
  department: string;
  functionName?: string;
  position: string;
  level: string;
};

type SelectedCourse = {
  companies: string[];
  targetFunctionCode: string;
  targetFunctionName: string;
  targetPositions: string[];
  targetLevels: string[];
};

const matchesCourseTarget = (selectedCourse: SelectedCourse, employee: SurveyEmployee) => {
  // 1. Company check
  const targetCompanies =
    selectedCourse.companies && selectedCourse.companies.length > 0
      ? selectedCourse.companies
      : ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];
  if (!targetCompanies.includes(employee.company)) {
    return false;
  }

  // 2. Function check
  const targetFn = (selectedCourse.targetFunctionName || "").trim();
  const targetCode = (selectedCourse.targetFunctionCode || "").trim().toUpperCase();
  const isAllFunction =
    !targetCode ||
    targetCode === "ALL" ||
    !targetFn ||
    targetFn.toLowerCase().includes("all function") ||
    targetFn.toLowerCase() === "all" ||
    targetFn === "ทุกฝ่ายงาน";

  if (!isAllFunction) {
    const clean = (s: string) => s.toLowerCase().replace(/[\s\.\(\)\-_'"]/g, "");
    const empFnCode = (employee.departmentCode || "").trim().toUpperCase();
    const empFnName = (employee.functionName || employee.department || "").trim();
    const fnMatches =
      (targetCode && empFnCode && empFnCode === targetCode) ||
      (targetFn && empFnName && clean(empFnName).includes(clean(targetFn))) ||
      (targetFn && empFnName && clean(targetFn).includes(clean(empFnName)));
    if (!fnMatches) {
      return false;
    }
  }

  const checkEmployeeTargetStatus = (course: SelectedCourse, emp: SurveyEmployee) => {
    // 1. Company check
    const targetCompanies =
      course.companies && course.companies.length > 0
        ? course.companies
        : ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];
    if (!targetCompanies.includes(emp.company)) {
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    }

    // 2. Function check
    const targetFn = (course.targetFunctionName || "").trim();
    const targetCode = (course.targetFunctionCode || "").trim().toUpperCase();
    const isAllFunction =
      !targetCode ||
      targetCode === "ALL" ||
      !targetFn ||
      targetFn.toLowerCase().includes("all function") ||
      targetFn.toLowerCase() === "all" ||
      targetFn === "ทุกฝ่ายงาน";

    if (!isAllFunction) {
      const clean = (s: string) => s.toLowerCase().replace(/[\s\.\(\)\-_'"]/g, "");
      const empFnCode = (emp.departmentCode || "").trim().toUpperCase();
      const empFnName = (emp.functionName || emp.department || "").trim();
      const fnMatches =
        (targetCode && empFnCode && empFnCode === targetCode) ||
        (targetFn && empFnName && clean(empFnName).includes(clean(targetFn))) ||
        (targetFn && empFnName && clean(targetFn).includes(clean(empFnName)));
      if (!fnMatches) {
        return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
      }
    }

    // 3. Level & Position check
    const hasPositions = Boolean(course.targetPositions && course.targetPositions.length > 0);
    const hasLevels = Boolean(course.targetLevels && course.targetLevels.length > 0);

    let lvlMatches = false;
    if (hasLevels) {
      const empLvlNorm = normalizeEmployeeLevel(emp.level);
      lvlMatches = course.targetLevels.some((lvl) => {
        const targetLvlNorm = normalizeEmployeeLevel(lvl);
        return targetLvlNorm === empLvlNorm;
      });
    }

    let posMatches = false;
    if (hasPositions) {
      const empPosNorm = normalizeTargetPosition(emp.position);
      posMatches = course.targetPositions.some((pos) => {
        const targetPosNorm = normalizeTargetPosition(pos);
        if (targetPosNorm === empPosNorm) return true;
        if (empPosNorm && targetPosNorm && (empPosNorm.includes(targetPosNorm) || targetPosNorm.includes(empPosNorm))) {
          return true;
        }
        return false;
      });
    }

    if (hasLevels && hasPositions) {
      if (lvlMatches && posMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      if (lvlMatches && !posMatches) {
        return { isExactMatch: false, isLevelOnlyMatch: true, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    } else if (hasLevels) {
      if (lvlMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    } else if (hasPositions) {
      if (posMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    }

    return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
  };

  const isExact = checkEmployeeTargetStatus(selectedCourse, employee).isExactMatch;
  return isExact;
};

describe("normalizeEmployeeLevel", () => {
  it("normalizes standard codes", () => {
    expect(normalizeEmployeeLevel("M1")).toBe("M1");
    expect(normalizeEmployeeLevel("S4")).toBe("S4");
    expect(normalizeEmployeeLevel("O1")).toBe("O1");
  });

  it("normalizes Thai short codes", () => {
    expect(normalizeEmployeeLevel("จ1")).toBe("M1");
    expect(normalizeEmployeeLevel("บ4")).toBe("S4");
    expect(normalizeEmployeeLevel("ป1")).toBe("O1");
  });

  it("normalizes Thai full names", () => {
    expect(normalizeEmployeeLevel("จัดการ1")).toBe("M1");
    expect(normalizeEmployeeLevel("บังคับบัญชา4")).toBe("S4");
    expect(normalizeEmployeeLevel("ปฏิบัติการ1")).toBe("O1");
  });

  it("normalizes dots, dashes and spaces", () => {
    expect(normalizeEmployeeLevel("จ.1")).toBe("M1");
    expect(normalizeEmployeeLevel("บ. 4")).toBe("S4");
    expect(normalizeEmployeeLevel("ป-1")).toBe("O1");
  });
});

describe("TrainingAcceptSurvey Target Group Matching Rules", () => {
  const courseWithLevelOnly: SelectedCourse = {
    companies: ["ATA", "SNF"],
    targetFunctionCode: "ALL",
    targetFunctionName: "All Function",
    targetPositions: [],
    targetLevels: ["S2", "S3"],
  };

  const courseWithLevelAndPosition: SelectedCourse = {
    companies: ["ATA", "SNF"],
    targetFunctionCode: "ALL",
    targetFunctionName: "All Function",
    targetPositions: ["Officer", "Foreman"],
    targetLevels: ["S2", "S3"],
  };

  it("matches employee when only level is selected (Level is primary / ไม่สนใจ position)", () => {
    const empS3: SurveyEmployee = {
      id: "emp-1",
      company: "ATA",
      departmentCode: "FNC001",
      department: "Production",
      position: "Any Position",
      level: "S3",
    };
    expect(matchesCourseTarget(courseWithLevelOnly, empS3)).toBe(true);

    const empS2: SurveyEmployee = {
      id: "emp-2",
      company: "ATA",
      departmentCode: "FNC001",
      department: "Production",
      position: "Another Position",
      level: "S2",
    };
    expect(matchesCourseTarget(courseWithLevelOnly, empS2)).toBe(true);
  });

  it("never includes S4 when user selected S2 and S3, even if position matches (Level is primary)", () => {
    const empS4: SurveyEmployee = {
      id: "emp-3",
      company: "ATA",
      departmentCode: "FNC001",
      department: "Production",
      position: "Officer", // Position is in targetPositions, but level S4 is NOT in targetLevels
      level: "S4",
    };

    expect(matchesCourseTarget(courseWithLevelAndPosition, empS4)).toBe(false);
    expect(matchesCourseTarget(courseWithLevelOnly, empS4)).toBe(false);
  });

  it("matches employee when BOTH level and position match (กรณี level กับ position ตรงกันให้ดึงมา)", () => {
    const empS3Officer: SurveyEmployee = {
      id: "emp-4",
      company: "ATA",
      departmentCode: "FNC001",
      department: "Production",
      position: "Officer", // Matches
      level: "S3", // Matches
    };

    expect(matchesCourseTarget(courseWithLevelAndPosition, empS3Officer)).toBe(true);
  });

  it("rejects employee if position does not match when both level and position are targeted", () => {
    const empS3Manager: SurveyEmployee = {
      id: "emp-5",
      company: "ATA",
      departmentCode: "FNC001",
      department: "Production",
      position: "Manager", // Not in targetPositions
      level: "S3",
    };

    expect(matchesCourseTarget(courseWithLevelAndPosition, empS3Manager)).toBe(false);
  });

  it("rejects employee if company does not match, regardless of level and position", () => {
    const empTEP: SurveyEmployee = {
      id: "emp-6",
      company: "TEP", // Not in ["ATA", "SNF"]
      departmentCode: "FNC001",
      department: "Production",
      position: "Officer",
      level: "S3",
    };

    expect(matchesCourseTarget(courseWithLevelAndPosition, empTEP)).toBe(false);
  });
});
