import { describe, expect, it, vi } from "vitest";
import {
  HIERARCHY_19_RANKS,
  getEmployee19Rank,
  getTargetApproverRank,
  getHierarchyRankInfo,
} from "../../app/lib/employeeMasterData";

describe("19-Rank Hierarchy & Approval Chain Rules", () => {
  it("defines all 19 ranks with code, thai name, and english name", () => {
    expect(HIERARCHY_19_RANKS).toHaveLength(19);
    expect(HIERARCHY_19_RANKS[0]).toMatchObject({ rank: 1, code: "PRES", nameEn: "President" });
    expect(HIERARCHY_19_RANKS[1]).toMatchObject({ rank: 2, code: "EVP", nameEn: "Executive Vice President" });
    expect(HIERARCHY_19_RANKS[2]).toMatchObject({ rank: 3, code: "VP", nameEn: "Vice President" });
    expect(HIERARCHY_19_RANKS[3]).toMatchObject({ rank: 4, code: "SADV", nameEn: "Senior Advisor" });
    expect(HIERARCHY_19_RANKS[4]).toMatchObject({ rank: 5, code: "ADV", nameEn: "Advisor" });
    expect(HIERARCHY_19_RANKS[5]).toMatchObject({ rank: 6, code: "SEC", nameEn: "Senior Executive Coordinator" });
    expect(HIERARCHY_19_RANKS[6]).toMatchObject({ rank: 7, code: "PM", nameEn: "Plant Manager" });
    expect(HIERARCHY_19_RANKS[7]).toMatchObject({ rank: 8, code: "EGM", nameEn: "Executive General Manager" });
    expect(HIERARCHY_19_RANKS[8]).toMatchObject({ rank: 9, code: "SGM", nameEn: "Senior General Manager" });
    expect(HIERARCHY_19_RANKS[9]).toMatchObject({ rank: 10, code: "GM", nameEn: "General Manager" });
    expect(HIERARCHY_19_RANKS[10]).toMatchObject({ rank: 11, code: "MGR", nameEn: "Manager" });
    expect(HIERARCHY_19_RANKS[11]).toMatchObject({ rank: 12, code: "SH", nameEn: "Section Head" });
    expect(HIERARCHY_19_RANKS[12]).toMatchObject({ rank: 13, code: "ENG", nameEn: "Engineer" });
    expect(HIERARCHY_19_RANKS[13]).toMatchObject({ rank: 14, code: "OFF", nameEn: "Officer" });
    expect(HIERARCHY_19_RANKS[14]).toMatchObject({ rank: 15, code: "SFM", nameEn: "Senior Foreman" });
    expect(HIERARCHY_19_RANKS[15]).toMatchObject({ rank: 16, code: "FM", nameEn: "Foreman" });
    expect(HIERARCHY_19_RANKS[16]).toMatchObject({ rank: 17, code: "LD", nameEn: "Leader" });
    expect(HIERARCHY_19_RANKS[17]).toMatchObject({ rank: 18, code: "STAFF", nameEn: "Staff" });
    expect(HIERARCHY_19_RANKS[18]).toMatchObject({ rank: 19, code: "OP", nameEn: "Operator" });
  });

  it("correctly identifies rank 1 to 19 for various positions and levels", () => {
    // Ranks 1 - 12
    expect(getEmployee19Rank({ positionCode: "PRES" })).toBe(1);
    expect(getEmployee19Rank({ positionName: "President" })).toBe(1);
    expect(getEmployee19Rank({ positionName: "ประธานบริษัท" })).toBe(1);

    expect(getEmployee19Rank({ positionCode: "EVP" })).toBe(2);
    expect(getEmployee19Rank({ positionCode: "VP" })).toBe(3);
    expect(getEmployee19Rank({ positionCode: "SADV" })).toBe(4);
    expect(getEmployee19Rank({ positionCode: "ADV" })).toBe(5);
    expect(getEmployee19Rank({ positionCode: "SEC" })).toBe(6);
    expect(getEmployee19Rank({ positionCode: "PM" })).toBe(7);
    expect(getEmployee19Rank({ positionCode: "EGM" })).toBe(8);
    expect(getEmployee19Rank({ positionCode: "SGM" })).toBe(9);
    expect(getEmployee19Rank({ positionCode: "GM" })).toBe(10);
    expect(getEmployee19Rank({ positionCode: "MGR" })).toBe(11);
    expect(getEmployee19Rank({ positionCode: "SH" })).toBe(12);

    // Ranks 13 - 19
    expect(getEmployee19Rank({ positionCode: "ENG" })).toBe(13);
    expect(getEmployee19Rank({ positionName: "วิศวกร" })).toBe(13);
    expect(getEmployee19Rank({ positionName: "Senior Engineer" })).toBe(13);

    expect(getEmployee19Rank({ positionCode: "OFF" })).toBe(14);
    expect(getEmployee19Rank({ positionName: "เจ้าหน้าที่" })).toBe(14);

    expect(getEmployee19Rank({ positionCode: "SFM" })).toBe(15);
    expect(getEmployee19Rank({ positionName: "ซีเนียร์โฟร์แมน" })).toBe(15);

    expect(getEmployee19Rank({ positionCode: "FM" })).toBe(16);
    expect(getEmployee19Rank({ positionName: "โฟร์แมน" })).toBe(16);

    expect(getEmployee19Rank({ positionCode: "LD" })).toBe(17);
    expect(getEmployee19Rank({ positionName: "ลีดเดอร์" })).toBe(17);

    expect(getEmployee19Rank({ positionCode: "STAFF" })).toBe(18);
    expect(getEmployee19Rank({ positionName: "พนักงาน" })).toBe(18);

    expect(getEmployee19Rank({ positionCode: "OP" })).toBe(19);
    expect(getEmployee19Rank({ positionName: "พนักงานปฏิบัติการ" })).toBe(19);
  });

  it("applies strict Option 1 direct chain of command approver rules", () => {
    // Rule 1: Employees with rank > 12 (below Section Head: 13..19) must be approved by Section Head (Rank 12)
    expect(getTargetApproverRank(19)).toBe(12); // Operator -> Section Head
    expect(getTargetApproverRank(18)).toBe(12); // Staff -> Section Head
    expect(getTargetApproverRank(17)).toBe(12); // Leader -> Section Head
    expect(getTargetApproverRank(16)).toBe(12); // Foreman -> Section Head
    expect(getTargetApproverRank(15)).toBe(12); // Senior Foreman -> Section Head
    expect(getTargetApproverRank(14)).toBe(12); // Officer -> Section Head
    expect(getTargetApproverRank(13)).toBe(12); // Engineer -> Section Head

    // Rule 2: Section Head (Rank 12) must be approved by Manager (Rank 11)
    expect(getTargetApproverRank(12)).toBe(11);

    // Rule 3: Manager (Rank 11) must be approved by General Manager (Rank 10)
    expect(getTargetApproverRank(11)).toBe(10);

    // Rule 4: General Manager (Rank 10) must be approved by Senior General Manager (Rank 9)
    expect(getTargetApproverRank(10)).toBe(9);

    // Rule 5: Executive levels are approved by direct superior level (R - 1)
    expect(getTargetApproverRank(9)).toBe(8); // SGM -> EGM
    expect(getTargetApproverRank(8)).toBe(7); // EGM -> PM
    expect(getTargetApproverRank(7)).toBe(6); // PM -> SEC
    expect(getTargetApproverRank(6)).toBe(5); // SEC -> ADV
    expect(getTargetApproverRank(5)).toBe(4); // ADV -> SADV
    expect(getTargetApproverRank(4)).toBe(3); // SADV -> VP
    expect(getTargetApproverRank(3)).toBe(2); // VP -> EVP
    expect(getTargetApproverRank(2)).toBe(1); // EVP -> President

    // Rule 6: President (Rank 1) is auto-approved
    expect(getTargetApproverRank(1)).toBe(1);
  });

  it("retrieves rank details via getHierarchyRankInfo", () => {
    const shInfo = getHierarchyRankInfo(12);
    expect(shInfo).not.toBeNull();
    expect(shInfo?.code).toBe("SH");
    expect(shInfo?.nameTh).toBe("ผู้จัดการแผนก");
    expect(shInfo?.nameEn).toBe("Section Head");

    const mgrInfo = getHierarchyRankInfo(11);
    expect(mgrInfo?.nameEn).toBe("Manager");

    const gmInfo = getHierarchyRankInfo(10);
    expect(gmInfo?.nameEn).toBe("General Manager");
  });
});
