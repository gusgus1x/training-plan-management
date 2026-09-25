/**
 * Utility functions for formatting Training Plan Batch (รุ่น) and Round / Session (รอบ)
 * across all modules (Calendar, Registration, Dashboard, Survey, Actual, Record).
 */

export interface BatchRoundSource {
  batchNo?: number | string | null;
  batchName?: string | null;
  batch?: string | null;
  planCode?: string | null;
}

/**
 * Extract clean numeric batch number from source if available.
 */
export const extractBatchNo = (source: BatchRoundSource | null | undefined): number | null => {
  if (!source) return null;
  if (source.batchNo !== undefined && source.batchNo !== null && source.batchNo !== "") {
    const num = Number(source.batchNo);
    if (!isNaN(num) && num > 0) return num;
  }
  // Try parsing from planCode (e.g. OAP-001-B02-R01 -> 2)
  if (source.planCode) {
    const match = source.planCode.match(/-B(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  // Fallback: try parsing from batch string if it starts with "Batch" or "รุ่น"
  if (source.batch) {
    const match = source.batch.match(/(?:batch|รุ่น(?:ที่)?)\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
    // If batch is purely numeric
    if (/^\d+$/.test(source.batch.trim())) {
      const num = parseInt(source.batch.trim(), 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
};

/**
 * Extract clean round / session name from source if available.
 */
export const extractRoundName = (source: BatchRoundSource | null | undefined): string => {
  if (!source) return "";
  if (source.batchName && source.batchName.trim()) {
    return source.batchName.trim();
  }
  // If batch string starts with "รอบ" or "Round", treat it as round name
  if (source.batch && /^(?:รอบ|round)/i.test(source.batch.trim())) {
    return source.batch.trim();
  }
  // Try extracting round number from planCode (e.g. OAP-001-B01-R03 -> "รอบที่ 3")
  if (source.planCode) {
    const match = source.planCode.match(/-R(\d+)/i);
    if (match) {
      const rNum = parseInt(match[1], 10);
      if (!isNaN(rNum) && rNum > 0) {
        return `รอบที่ ${rNum}`;
      }
    }
  }
  return "";
};

/**
 * Returns formatted batch text only, e.g. "รุ่น 1" or "Batch 1".
 */
export const formatBatchText = (
  source: BatchRoundSource | null | undefined,
  isThai = true,
): string => {
  const batchNo = extractBatchNo(source);
  if (batchNo !== null) {
    return isThai ? `รุ่น ${batchNo}` : `Batch ${batchNo}`;
  }
  // Fallback if source.batch has non-round string
  if (source?.batch && !/^(?:รอบ|round)/i.test(source.batch.trim())) {
    return source.batch.trim();
  }
  return "";
};

/**
 * Returns formatted round text only, e.g. "รอบที่ 1" or "Round 1".
 */
export const formatRoundText = (
  source: BatchRoundSource | null | undefined,
  isThai = true,
): string => {
  const round = extractRoundName(source);
  if (!round) return "";
  if (!isThai && round.startsWith("รอบที่ ")) {
    return round.replace("รอบที่ ", "Round ");
  }
  if (!isThai && round.startsWith("รอบ ")) {
    return round.replace("รอบ ", "Round ");
  }
  return round;
};

/**
 * Returns combined text label, e.g. "รุ่น 1 (รอบที่ 1)" or "Batch 1 (Round 1)".
 */
export const formatBatchRoundText = (
  source: BatchRoundSource | null | undefined,
  isThai = true,
): string => {
  if (!source) return "";
  const bText = formatBatchText(source, isThai);
  const rText = formatRoundText(source, isThai);

  if (bText && rText) {
    return `${bText} (${rText})`;
  }
  if (bText) return bText;
  if (rText) return rText;
  return source.batch || "";
};

/**
 * Short badge notation, e.g. "B1 · R1" or "รุ่น 1 · รอบ 1".
 */
export const formatBatchRoundShort = (
  source: BatchRoundSource | null | undefined,
  isThai = true,
): string => {
  const batchNo = extractBatchNo(source);
  const round = extractRoundName(source);
  const roundMatch = round.match(/\d+/);
  const roundNo = roundMatch ? roundMatch[0] : "";

  if (batchNo && roundNo) {
    return isThai ? `รุ่น ${batchNo} · รอบ ${roundNo}` : `B${batchNo} · R${roundNo}`;
  }
  if (batchNo) {
    return isThai ? `รุ่น ${batchNo}` : `B${batchNo}`;
  }
  if (round) {
    return round;
  }
  return source?.batch || "";
};
