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
