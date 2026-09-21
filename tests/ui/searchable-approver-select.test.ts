import { describe, expect, it } from "vitest";
import type { ApproverCandidateItem } from "../../app/components/employee/SearchableApproverSelect";

const mockCandidates: ApproverCandidateItem[] = [
  {
    reviewerUserId: "101",
    employeeUserId: "emp-101",
    employeeCode: "001234",
    name: "กนกพร อินทร์ฉ่ำ",
    position: "ผู้จัดการ",
    rank: 11,
    rankTitleEn: "Manager",
    rankTitleTh: "ผู้จัดการ",
    company: "ATA",
    department: "ส่วนควบคุมการผลิต",
    section: "ควบคุมการผลิต",
  },
  {
    reviewerUserId: "102",
    employeeUserId: "emp-102",
    employeeCode: "005678",
    name: "สมชาย ใจดี",
    position: "หัวหน้าแผนก",
    rank: 12,
    rankTitleEn: "Section Head",
    rankTitleTh: "หัวหน้าแผนก",
    company: "ATA",
    department: "ส่วนบุคคลและธุรการ",
    section: "งานพัฒนาทรัพยากรบุคคล",
  },
  {
    reviewerUserId: "103",
    employeeUserId: "emp-103",
    employeeCode: "009999",
    name: "John Doe",
    position: "General Manager",
    rank: 10,
    rankTitleEn: "General Manager",
    rankTitleTh: "ผู้จัดการทั่วไป",
    company: "BAT",
    department: "Executive Office",
    section: "Operation",
  },
];

const filterCandidates = (candidates: ApproverCandidateItem[], query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;

  return candidates.filter((cand) => {
    const matchName = cand.name.toLowerCase().includes(q);
    const matchCode = cand.employeeCode.toLowerCase().includes(q);
    const matchPosition = cand.position.toLowerCase().includes(q);
    const matchRankTh = (cand.rankTitleTh || "").toLowerCase().includes(q);
    const matchRankEn = (cand.rankTitleEn || "").toLowerCase().includes(q);
    const matchDept = (cand.department || "").toLowerCase().includes(q);
    const matchSection = (cand.section || "").toLowerCase().includes(q);
    const matchCompany = (cand.company || "").toLowerCase().includes(q);

    return (
      matchName ||
      matchCode ||
      matchPosition ||
      matchRankTh ||
      matchRankEn ||
      matchDept ||
      matchSection ||
      matchCompany
    );
  });
};

describe("SearchableApproverSelect Filtering Logic", () => {
  it("returns all candidates when search query is empty", () => {
    expect(filterCandidates(mockCandidates, "")).toHaveLength(3);
    expect(filterCandidates(mockCandidates, "   ")).toHaveLength(3);
  });

  it("filters candidates by Thai name substring", () => {
    const res = filterCandidates(mockCandidates, "กนกพร");
    expect(res).toHaveLength(1);
    expect(res[0].reviewerUserId).toBe("101");
  });

  it("filters candidates by English name case-insensitively", () => {
    const res = filterCandidates(mockCandidates, "john");
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("filters candidates by employee code", () => {
    const res = filterCandidates(mockCandidates, "005678");
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("สมชาย ใจดี");
  });

  it("filters candidates by department or section", () => {
    const res = filterCandidates(mockCandidates, "ควบคุมการผลิต");
    expect(res).toHaveLength(1);
    expect(res[0].reviewerUserId).toBe("101");
  });

  it("filters candidates by position or rank title", () => {
    const res = filterCandidates(mockCandidates, "General Manager");
    expect(res).toHaveLength(1);
    expect(res[0].reviewerUserId).toBe("103");
  });

  it("returns empty array when no matches are found", () => {
    const res = filterCandidates(mockCandidates, "NonExistentApproverXYZ");
    expect(res).toHaveLength(0);
  });
});
