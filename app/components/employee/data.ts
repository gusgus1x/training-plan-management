export type UserModule = "register" | "roadmap" | "request" | "record" | "report" | "calendar";

export const moduleCards: Array<{
  key: UserModule;
  eyebrow: string;
  title: string;
  detail: string;
  locked?: boolean;
}> = [
  {
    key: "register",
    eyebrow: "Register",
    title: "Register Train",
    detail: "Select available courses, submit registration, and let HRD review the request.",
  },
  {
    key: "roadmap",
    eyebrow: "Roadmap",
    title: "Training Roadmap",
    detail: "Review the personal development plan and required courses by timeline.",
  },
  {
    key: "request",
    eyebrow: "Need",
    title: "Request Training Need",
    detail: "Submit a new training need to HRD Center for review and approval.",
  },
  {
    key: "record",
    eyebrow: "Record",
    title: "My Record",
    detail: "Check training history, accumulated hours, course results, and evidence status.",
  },
  {
    key: "report",
    eyebrow: "Report",
    title: "Training Report",
    detail: "Prepare and review employee training reports for HRD follow-up.",
    locked: true,
  },
  {
    key: "calendar",
    eyebrow: "Calendar",
    title: "Calendar Training",
    detail: "Monthly and annual training schedule calendar for employee operations.",
  },
];
