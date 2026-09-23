import type { CourseCoverageEmployee } from "./types";

/** target = the course's target group; company = everyone in the company; all = everyone (center). */
export type CoverageView = "target" | "company" | "all";

export type CoverageCount = { total: number; trained: number; remain: number; pct: number };
export type CoverageSection = CoverageCount & { name: string };
export type CoverageDepartment = CoverageCount & { name: string; sections: CoverageSection[] };
export type CoverageSummary = CoverageCount & { departments: CoverageDepartment[] };

/** `company` is a company code, or "ALL" for every company the caller can see. */
export const filterByView = (rows: CourseCoverageEmployee[], view: CoverageView, company: string) =>
  rows.filter(
    (row) => (view !== "target" || row.inTarget) && (view === "all" || company === "ALL" || row.companyCode === company),
  );

const count = (rows: CourseCoverageEmployee[]): CoverageCount => {
  const trained = rows.filter((row) => row.timesTrained > 0).length;
  return { total: rows.length, trained, remain: rows.length - trained, pct: rows.length ? (trained / rows.length) * 100 : 0 };
};

const byName = (a: { name: string }, b: { name: string }) =>
  // Unnamed groups ("") sort last.
  (a.name === "") === (b.name === "") ? a.name.localeCompare(b.name, "th") : a.name === "" ? 1 : -1;

const groupBy = (rows: CourseCoverageEmployee[], key: (row: CourseCoverageEmployee) => string) => {
  const groups = new Map<string, CourseCoverageEmployee[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return [...groups];
};

/** Trained vs remaining, overall and per department (ส่วน) → section (แผนก). */
export const summarize = (rows: CourseCoverageEmployee[]): CoverageSummary => ({
  ...count(rows),
  departments: groupBy(rows, (row) => row.department)
    .map(([name, departmentRows]) => ({
      name,
      ...count(departmentRows),
      sections: groupBy(departmentRows, (row) => row.section)
        .map(([sectionName, sectionRows]) => ({ name: sectionName, ...count(sectionRows) }))
        .sort(byName),
    }))
    .sort(byName),
});
