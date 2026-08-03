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
