export type CalendarDateParts = {
  year: string;
  month: string;
  day: number;
};

export const getCurrentCalendarDate = (
  date: Date = new Date(),
): CalendarDateParts => ({
  year: String(date.getFullYear()),
  month: String(date.getMonth() + 1).padStart(2, "0"),
  day: date.getDate(),
});

/**
 * Today as YYYY-MM-DD in the viewer's own timezone.
 *
 * `new Date().toISOString().slice(0, 10)` answers in UTC, which in Thailand (UTC+7) is *yesterday*
 * for every local time before 07:00 — so a session saved at 08:30 on 5 March with the date left
 * blank was created for 4 March, a day already past.
 */
export const getLocalDateString = (date: Date = new Date()) => {
  const { year, month } = getCurrentCalendarDate(date);
  return `${year}-${month}-${String(date.getDate()).padStart(2, "0")}`;
};

export const buildCalendarYearOptions = (
  currentYear: string,
  trainingDates: string[],
) =>
  [...new Set([
    String(Number(currentYear) - 1),
    currentYear,
    String(Number(currentYear) + 1),
    ...trainingDates
      .map((date) => date.slice(0, 4))
      .filter((year) => /^\d{4}$/.test(year)),
  ])].sort((left, right) => Number(left) - Number(right));

/**
 * Checks whether a course training date (and optional end date or end time) has already passed.
 * Supports date formats:
 * - YYYY-MM-DD
 * - ISO string (YYYY-MM-DDTHH:mm:ss...)
 * - DD/MM/YYYY or DD-MM-YYYY
 * If endTime is provided (e.g. "16:30" or "16:30:00"), it checks against current time on that date.
 * If no endTime is provided, it considers the day ended at 23:59:59.999.
 */
export const isCourseDateOrTimeEnded = (
  dateStr?: string | null,
  endDateStr?: string | null,
  endTimeStr?: string | null,
  now: Date = new Date(),
): boolean => {
  if (!dateStr || dateStr === "-" || !dateStr.trim()) return false;
  const targetDateStr = (endDateStr && endDateStr !== "-" && endDateStr.trim()) ? endDateStr.trim() : dateStr.trim();

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  // Check YYYY-MM-DD or ISO
  const isoMatch = targetDateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else {
    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = targetDateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10) - 1;
      year = parseInt(dmyMatch[3], 10);
    }
  }

  if (year === null || month === null || day === null) {
    const parsed = new Date(targetDateStr);
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    } else {
      return false;
    }
  }

  let endHour = 23;
  let endMinute = 59;
  let endSecond = 59;

  if (endTimeStr && endTimeStr !== "-" && endTimeStr.trim()) {
    const timeMatch = endTimeStr.trim().match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      endHour = parseInt(timeMatch[1], 10);
      endMinute = parseInt(timeMatch[2], 10);
      endSecond = 0;
    }
  }

  const endDateTime = new Date(year, month, day, endHour, endMinute, endSecond, 999);
  return endDateTime.getTime() < now.getTime();
};

export const TH_SHORT_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

export const EN_SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Parses day, month (1-12), and year from various date string formats:
 * - YYYY-MM-DD or YYYY/MM/DD
 * - ISO string (YYYY-MM-DDTHH:mm:ss...)
 * - DD/MM/YYYY or DD-MM-YYYY
 */
export const parseDateParts = (
  dateStr?: string | null,
): { day: number; month: number; year: number } | null => {
  if (!dateStr || dateStr === "-" || !dateStr.trim()) return null;
  const clean = dateStr.trim();

  // YYYY-MM-DD or ISO
  const isoMatch = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return { day, month, year };
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return { day, month, year };
    }
  }

  // Fallback to JS Date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return {
      day: parsed.getDate(),
      month: parsed.getMonth() + 1,
      year: parsed.getFullYear(),
    };
  }

  return null;
};

/**
 * Formats a single date as "Day Month Year" with short month:
 * Thai: "1 ต.ค. 2026"
 * English: "1 Oct 2026"
 */
export const formatDateDayMonthYear = (
  dateStr?: string | null,
  isThai: boolean = true,
): string => {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr || "-";

  const monthLabel = isThai
    ? TH_SHORT_MONTHS[parts.month - 1] ?? String(parts.month)
    : EN_SHORT_MONTHS[parts.month - 1] ?? String(parts.month);

  return `${parts.day} ${monthLabel} ${parts.year}`;
};

/**
 * Formats a date range as Day Month Year:
 * - Single day: "1 ต.ค. 2026"
 * - Multi-day: "1 ต.ค. 2026 - 2 ต.ค. 2026" (or across months "30 ก.ย. 2026 - 2 ต.ค. 2026")
 */
export const formatDateRangeDayMonthYear = (
  startDateStr?: string | null,
  endDateStr?: string | null,
  isThai: boolean = true,
): string => {
  if (!startDateStr || startDateStr === "-") return "-";
  const startFormatted = formatDateDayMonthYear(startDateStr, isThai);

  if (!endDateStr || endDateStr === "-" || endDateStr === startDateStr) {
    return startFormatted;
  }

  const endFormatted = formatDateDayMonthYear(endDateStr, isThai);
  if (startFormatted === endFormatted) {
    return startFormatted;
  }

  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Calculates inclusive days between two date strings:
 * e.g. 2026-10-01 to 2026-10-02 = 2 days
 */
export const calculateDaysBetween = (
  startDateStr?: string | null,
  endDateStr?: string | null,
): number => {
  const startParts = parseDateParts(startDateStr);
  if (!startParts) return 1;

  if (!endDateStr || endDateStr === "-" || endDateStr === startDateStr) {
    return 1;
  }

  const endParts = parseDateParts(endDateStr);
  if (!endParts) return 1;

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  if (endUtc <= startUtc) return 1;

  const diffDays = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

/**
 * Formats duration with daily breakdown if training is 2 days or more:
 * e.g. 2 days, 18 hrs:
 * Thai: "วันละ 9 ชม. / รวม 18 ชม."
 * English: "9 hrs/day · 18 hrs total"
 * 1 day, 6 hrs:
 * Thai: "6 ชม."
 * English: "6 hrs"
 */
export const formatTrainingDuration = (
  hours?: number | string | null,
  startDateStr?: string | null,
  endDateStr?: string | null,
  isThai: boolean = true,
): string => {
  const numHours = typeof hours === "number" ? hours : parseFloat(String(hours || "0"));
  const days = calculateDaysBetween(startDateStr, endDateStr);

  const hourUnit = isThai ? "ชม." : "hrs";

  if (isNaN(numHours) || numHours <= 0) {
    return isThai ? "ยังไม่ระบุ" : "Not specified";
  }

  if (days > 1) {
    const dailyHours = Math.round((numHours / days) * 10) / 10;
    if (isThai) {
      return `วันละ ${dailyHours} ${hourUnit} / รวม ${numHours} ${hourUnit}`;
    }
    return `${dailyHours} ${hourUnit}/day · ${numHours} ${hourUnit} total`;
  }

  return `${numHours} ${hourUnit}`;
};

