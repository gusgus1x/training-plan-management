export type UserModule = "register" | "roadmap" | "request" | "record" | "calendar" | "activities";

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
    key: "calendar",
    eyebrow: "Calendar",
    title: "Calendar Training",
    detail: "Monthly and annual training schedule calendar for employee operations.",
  },
  {
    key: "activities",
    eyebrow: "Activities",
    title: "New Activities",
    detail: "Browse company training news, event photos, and announcements across all companies.",
  },
];
