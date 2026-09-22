import { describe, expect, it } from "vitest";

type MockEmployee = {
  id: string;
  employeeCode: string;
  department: string;
  section?: string;
  name: string;
};

type MockPriorHistory = {
  courseId: string;
  planYear?: number;
};

type MockEnrollment = {
  employeeId: string;
  status: string;
};

function filterEmployees({
  employees,
  selectedDepartment,
  selectedHistoryStatus,
  searchQuery,
  courseHistoryMap = new Map(),
  draftSubmittedEmployees = [],
  enrollments = [],
}: {
  employees: MockEmployee[];
  selectedDepartment: string;
  selectedHistoryStatus: string;
  searchQuery: string;
  courseHistoryMap?: Map<string, MockPriorHistory>;
  draftSubmittedEmployees?: MockEmployee[];
  enrollments?: MockEnrollment[];
}) {
  const q = searchQuery.trim().toLowerCase();
  return employees.filter((emp) => {
    // 1. Department Filter
    if (selectedDepartment) {
      if (emp.department?.trim() !== selectedDepartment) return false;
    }

    // 2. History & Status Filter
    if (selectedHistoryStatus) {
      const priorHistory = courseHistoryMap.get(emp.id) || courseHistoryMap.get(emp.employeeCode);
      const isDraft = draftSubmittedEmployees.some(
        (d) => d.id === emp.id || d.employeeCode === emp.employeeCode,
      );
      const enrollment = enrollments.find((c) => c.employeeId === emp.id);

      if (selectedHistoryStatus === "trained_prior") {
        if (!priorHistory) return false;
      } else if (selectedHistoryStatus === "not_trained") {
        if (priorHistory || enrollment || isDraft) return false;
      } else if (selectedHistoryStatus === "draft") {
        if (!isDraft) return false;
      } else if (selectedHistoryStatus === "pending") {
        if (enrollment?.status !== "Pending Approval") return false;
      } else if (selectedHistoryStatus === "approved") {
        if (enrollment?.status !== "Factory Approved" && enrollment?.status !== "Center Approved") return false;
      } else if (selectedHistoryStatus === "rejected") {
        if (enrollment?.status !== "Rejected") return false;
      }
    }

    // 3. Search text
    if (q) {
      const text = [emp.employeeCode, emp.name, emp.department].filter(Boolean).join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  });
}

describe("TrainingAcceptSurvey Employee Multi-Filter", () => {
  const mockEmployees: MockEmployee[] = [
    { id: "1", employeeCode: "1290-0001", name: "สมชาย สายลม", department: "IT" },
    { id: "2", employeeCode: "1290-0002", name: "สมศรี มีสุข", department: "HR" },
    { id: "3", employeeCode: "1290-0003", name: "สมศักดิ์ รักชาติ", department: "IT" },
    { id: "4", employeeCode: "1290-0004", name: "วิชัย ใจดี", department: "Production" },
  ];

  const courseHistoryMap = new Map<string, MockPriorHistory>([
    ["1", { courseId: "CRS-001", planYear: 2025 }],
  ]);

  const enrollments: MockEnrollment[] = [
    { employeeId: "2", status: "Pending Approval" },
  ];

  it("filters by department only", () => {
    const result = filterEmployees({
      employees: mockEmployees,
      selectedDepartment: "IT",
      selectedHistoryStatus: "",
      searchQuery: "",
      courseHistoryMap,
      enrollments,
    });
    expect(result.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("filters by training history: trained_prior", () => {
    const result = filterEmployees({
      employees: mockEmployees,
      selectedDepartment: "",
      selectedHistoryStatus: "trained_prior",
      searchQuery: "",
      courseHistoryMap,
      enrollments,
    });
    expect(result.map((e) => e.id)).toEqual(["1"]);
  });

  it("filters by training status: pending", () => {
    const result = filterEmployees({
      employees: mockEmployees,
      selectedDepartment: "",
      selectedHistoryStatus: "pending",
      searchQuery: "",
      courseHistoryMap,
      enrollments,
    });
    expect(result.map((e) => e.id)).toEqual(["2"]);
  });

  it("filters by not_trained (neither history nor pending enrollment nor draft)", () => {
    const result = filterEmployees({
      employees: mockEmployees,
      selectedDepartment: "",
      selectedHistoryStatus: "not_trained",
      searchQuery: "",
      courseHistoryMap,
      enrollments,
    });
    expect(result.map((e) => e.id)).toEqual(["3", "4"]);
  });

  it("combines department + status + search query", () => {
    const result = filterEmployees({
      employees: mockEmployees,
      selectedDepartment: "IT",
      selectedHistoryStatus: "not_trained",
      searchQuery: "สมศักดิ์",
      courseHistoryMap,
      enrollments,
    });
    expect(result.map((e) => e.id)).toEqual(["3"]);
  });

  it("returns empty when combined filters do not match any record", () => {
    const result = filterEmployees({
      employees: mockEmployees,
      selectedDepartment: "HR",
      selectedHistoryStatus: "trained_prior",
      searchQuery: "",
      courseHistoryMap,
      enrollments,
    });
    expect(result).toHaveLength(0);
  });
});
