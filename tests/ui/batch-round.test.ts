import { describe, expect, it } from "vitest";
import {
  extractBatchNo,
  extractRoundName,
  formatBatchText,
  formatRoundText,
  formatBatchRoundText,
  formatBatchRoundShort,
} from "../../app/lib/batchRound";

describe("batchRound formatter utilities", () => {
  describe("extractBatchNo", () => {
    it("extracts numeric batchNo from direct number", () => {
      expect(extractBatchNo({ batchNo: 2 })).toBe(2);
      expect(extractBatchNo({ batchNo: "3" })).toBe(3);
    });

    it("extracts batchNo from planCode B-tag", () => {
      expect(extractBatchNo({ planCode: "CRS-001-B05-R01" })).toBe(5);
    });

    it("extracts batchNo from legacy batch string", () => {
      expect(extractBatchNo({ batch: "Batch 4" })).toBe(4);
      expect(extractBatchNo({ batch: "รุ่นที่ 3" })).toBe(3);
      expect(extractBatchNo({ batch: "รุ่น 2" })).toBe(2);
      expect(extractBatchNo({ batch: "1" })).toBe(1);
    });

    it("returns null when no batch number can be resolved", () => {
      expect(extractBatchNo(null)).toBeNull();
      expect(extractBatchNo({})).toBeNull();
      expect(extractBatchNo({ batch: "รอบที่ 1" })).toBeNull();
    });
  });

  describe("extractRoundName", () => {
    it("extracts batchName directly", () => {
      expect(extractRoundName({ batchName: "รอบที่ 1" })).toBe("รอบที่ 1");
      expect(extractRoundName({ batchName: "รอบพิเศษ" })).toBe("รอบพิเศษ");
    });

    it("extracts round from batch if it starts with รอบ or Round", () => {
      expect(extractRoundName({ batch: "รอบที่ 2" })).toBe("รอบที่ 2");
      expect(extractRoundName({ batch: "Round 1" })).toBe("Round 1");
    });

    it("extracts round number from planCode R-tag", () => {
      expect(extractRoundName({ planCode: "CRS-001-B01-R03" })).toBe("รอบที่ 3");
    });

    it("returns empty string when no round is found", () => {
      expect(extractRoundName(null)).toBe("");
      expect(extractRoundName({ batchNo: 1, batch: "Batch 1" })).toBe("");
    });
  });

  describe("formatBatchText", () => {
    it("formats Thai and English batch labels", () => {
      expect(formatBatchText({ batchNo: 1 }, true)).toBe("รุ่น 1");
      expect(formatBatchText({ batchNo: 1 }, false)).toBe("Batch 1");
    });
  });

  describe("formatRoundText", () => {
    it("formats Thai and English round labels", () => {
      expect(formatRoundText({ batchName: "รอบที่ 2" }, true)).toBe("รอบที่ 2");
      expect(formatRoundText({ batchName: "รอบที่ 2" }, false)).toBe("Round 2");
      expect(formatRoundText({ batchName: "รอบ 3" }, false)).toBe("Round 3");
    });
  });

  describe("formatBatchRoundText", () => {
    it("combines both batch and round when both exist", () => {
      expect(formatBatchRoundText({ batchNo: 1, batchName: "รอบที่ 1" }, true)).toBe("รุ่น 1 (รอบที่ 1)");
      expect(formatBatchRoundText({ batchNo: 2, batchName: "รอบที่ 3" }, false)).toBe("Batch 2 (Round 3)");
    });

    it("returns only batch when round is missing", () => {
      expect(formatBatchRoundText({ batchNo: 1 }, true)).toBe("รุ่น 1");
      expect(formatBatchRoundText({ batchNo: 1 }, false)).toBe("Batch 1");
    });

    it("returns only round when batch is missing", () => {
      expect(formatBatchRoundText({ batchName: "รอบพิเศษ" }, true)).toBe("รอบพิเศษ");
    });
  });

  describe("formatBatchRoundShort", () => {
    it("returns short notation", () => {
      expect(formatBatchRoundShort({ batchNo: 1, batchName: "รอบที่ 2" }, true)).toBe("รุ่น 1 · รอบ 2");
      expect(formatBatchRoundShort({ batchNo: 1, batchName: "รอบที่ 2" }, false)).toBe("B1 · R2");
      expect(formatBatchRoundShort({ batchNo: 3 }, false)).toBe("B3");
    });
  });
});
