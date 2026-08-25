export type BudgetEstimateInput = {
  /** Total budget for the whole course, as stored (a string in the plan records). */
  totalBudget: string | number | null | undefined;
  /** Planned head count for the whole course. */
  participants: string | number | null | undefined;
  /** Target companies the seats are shared between. */
  companyCount: number;
};

export type BudgetEstimate = {
  totalBudget: number;
  participants: number;
  companyCount: number;
  /** Seats each company may fill. Floored — a fraction of a seat cannot be sent. */
  seatsPerCompany: number | null;
  /** Cost per head when the course fills up. */
  costPerPerson: number | null;
  /** What one company pays when it fills its share. */
  costPerCompany: number | null;
};

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Per-head and per-company cost for a training plan, assuming the course fills up.
 *
 * Every figure is null rather than 0 when it cannot be derived (no head count, no target
 * company), so the UI can show "-" instead of a confident but meaningless zero.
 */
export const calculateBudgetEstimate = ({
  totalBudget,
  participants,
  companyCount,
}: BudgetEstimateInput): BudgetEstimate => {
  const budget = toNumber(totalBudget);
  const heads = toNumber(participants);
  const companies = Number.isFinite(companyCount) ? Math.max(0, Math.trunc(companyCount)) : 0;

  const costPerPerson = heads > 0 ? budget / heads : null;
  const seatsPerCompany = companies > 0 && heads > 0 ? Math.floor(heads / companies) : null;
  const costPerCompany =
    seatsPerCompany !== null && costPerPerson !== null ? seatsPerCompany * costPerPerson : null;

  return {
    totalBudget: budget,
    participants: heads,
    companyCount: companies,
    seatsPerCompany,
    costPerPerson,
    costPerCompany,
  };
};

export const formatBaht = (value: number | null) =>
  value === null
    ? "-"
    : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
