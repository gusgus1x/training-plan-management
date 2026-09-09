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

