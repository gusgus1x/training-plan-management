export type TrainingRecordExpenses = {
  accommodation: number;
  foodBeverage: number;
  instructor: number;
  material: number;
  seminarRoom: number;
  traveling: number;
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
