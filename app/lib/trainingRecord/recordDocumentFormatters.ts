const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/**
 * Format date to full Thai date: เช่น 16 เมษายน 2525
 */
export const formatThaiDateFull = (dateStr?: string | Date | null): string => {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return String(dateStr);

  const day = date.getDate();
  const month = THAI_MONTHS_FULL[date.getMonth()];
  const year = date.getFullYear() + 543; // Buddhist Era

  return `${day} ${month} ${year}`;
};

/**
 * Format date to short Thai date: เช่น 18 ก.ค. 35 หรือ 14 มิ.ย. 37
 */
export const formatThaiDateShort = (dateStr?: string | Date | null): string => {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (Number.isNaN(date.getTime())) return String(dateStr);

  const day = date.getDate();
  const month = THAI_MONTHS_SHORT[date.getMonth()];
  const yearBe = (date.getFullYear() + 543) % 100;
  const yearStr = String(yearBe).padStart(2, "0");

  return `${day} ${month} ${yearStr}`;
};

/**
 * Calculate work duration in years and months from workday to now:
 * เช่น "37 ปี 8 เดือน" หรือ "2 ปี 3 เดือน"
 */
export const calculateWorkDuration = (
  workdayStr?: string | Date | null,
  referenceDate: Date = new Date(),
): string => {
  if (!workdayStr) return "-";
  const start = typeof workdayStr === "string" ? new Date(workdayStr) : workdayStr;
  if (Number.isNaN(start.getTime())) return "-";

  let years = referenceDate.getFullYear() - start.getFullYear();
  let months = referenceDate.getMonth() - start.getMonth();

  if (referenceDate.getDate() < start.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return "-";

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ปี`);
  }
  if (months > 0 || years === 0) {
    parts.push(`${months} เดือน`);
  }

  return parts.join(" ") || "0 เดือน";
};
