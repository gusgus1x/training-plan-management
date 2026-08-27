export type TrainingRecordExpenses = {
  accommodation: number;
  foodBeverage: number;
  instructor: number;
  material: number;
  seminarRoom: number;
  traveling: number;
};

/** The three values dbo.training_result's check constraint allows. */
export const COMPLETION_STATUSES = ["PENDING", "NOT_COMPLETED", "COMPLETED"] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

/**
 * What HRD reads on screen. The stored values are database enum names; nobody filling in a
 * roster knows what NOT_COMPLETED is supposed to mean, and the question they are actually
 * answering is whether the person passed.
 */
export const completionStatusLabel = (status: CompletionStatus, language: "th" | "en") =>
  ({
    COMPLETED: { th: "ผ่าน", en: "Passed" },
    NOT_COMPLETED: { th: "ไม่ผ่าน", en: "Not passed" },
    PENDING: { th: "ยังไม่ระบุ", en: "Not decided" },
  })[status][language === "th" ? "th" : "en"];

/** What HRD records for one attendee once the course is over. */
export type TrainingResultEntry = {
  enrollmentId: string;
  preScore: number | null;
  postScore: number | null;
  completionStatus: CompletionStatus;
  completedAt: string | null;
  validUntil: string | null;
  certificateNo: string | null;
};

export type TrainingRecordAttendee = {
  enrollmentId: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  company: string;
  attended: boolean;
  preTestPassed: boolean | null;
  postTestPassed: boolean | null;
  evaluationCompleted: boolean;
  /** null until HRD records one. */
  result: TrainingResultEntry | null;
};

export type SaveResultsInput = {
  results: Array<{
    enrollmentId: string;
    preScore: number | null;
    postScore: number | null;
    completionStatus: CompletionStatus;
    validUntil: string | null;
    certificateNo: string | null;
  }>;
};

export type TrainingRecordSummary = {
  planId: string;
  registeredCount: number;
  attendedCount: number;
  expenses: TrainingRecordExpenses;
  preTestPassCount: number;
  postTestPassCount: number;
  evaluationCompletedCount: number;
  attendees: TrainingRecordAttendee[];
  savedAt: string;
};

export type CompanyCostBreakdownRow = {
  companyCode: string;
  presentCount: number;
  allocatedCost: number;
};

export type CostBreakdown = {
  planId: string;
  plannedTotals: TrainingRecordExpenses;
  plannedGrandTotal: number;
  actualTotals: TrainingRecordExpenses;
  actualGrandTotal: number;
  presentCount: number;
  costPerPerson: number;
  companyBreakdown: CompanyCostBreakdownRow[];
};

export const EXPENSE_CATEGORIES = [
  "ACCOMMODATION",
  "FOOD_BEVERAGE",
  "INSTRUCTOR",
  "MATERIAL",
  "SEMINAR_ROOM",
  "TRAVELING",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type SaveExpensesInput = Record<
  "accommodation" | "foodBeverage" | "instructor" | "material" | "seminarRoom" | "traveling",
  number
>;

export type ExpenseKey = keyof SaveExpensesInput;

/**
 * One name per expense, shared by every screen. Training Actual and Training Record each had their
 * own list, and the same key read "ค่าวัดผล / เอกสารประกอบ" on the form and "ค่าเอกสาร & อุปกรณ์"
 * on the report - two different things to anyone reading them side by side.
 */
export const EXPENSE_ITEMS: ReadonlyArray<{ key: ExpenseKey; label: string; icon: string }> = [
  { key: "instructor", label: "ค่าวิทยากร (Instructor)", icon: "👨‍🏫" },
  { key: "traveling", label: "ค่าเดินทาง (Traveling)", icon: "🚗" },
  { key: "seminarRoom", label: "ค่าห้องอบรม & สถานที่ (Seminar Room)", icon: "🏢" },
  { key: "accommodation", label: "ค่าที่พัก (Accommodation)", icon: "🏨" },
  { key: "material", label: "ค่าเอกสาร & อุปกรณ์ (Material)", icon: "📚" },
  { key: "foodBeverage", label: "ค่าอาหาร & เครื่องดื่ม (Food & Beverage)", icon: "🍱" },
];
