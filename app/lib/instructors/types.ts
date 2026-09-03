export const INSTRUCTOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type InstructorStatus = (typeof INSTRUCTOR_STATUSES)[number];

export type InstructorRecord = {
  instructorId: string;
  instructorCode: string;
  firstName: string;
  lastName: string;
  telephone: string | null;
  email: string | null;
  education: string | null;
  university: string | null;
  organizationName: string | null;
  status: InstructorStatus;
};

export type InstructorListFilters = {
  search: string | null;
  status: InstructorStatus | null;
  skip: number;
  take: number;
};

export type CreateInstructorInput = {
  instructorCode: string;
  firstName: string;
  lastName: string;
  telephone: string | null;
  email: string | null;
  education: string | null;
  university: string | null;
  organizationName: string | null;
  status: InstructorStatus;
};

export type UpdateInstructorInput = Partial<CreateInstructorInput>;

export type DeleteInstructorResult = {
  instructor: InstructorRecord;
  outcome: "DELETED" | "DEACTIVATED";
};
