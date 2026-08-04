export const COURSE_TYPE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CourseTypeStatus = (typeof COURSE_TYPE_STATUSES)[number];

export type CourseTypeRecord = {
  courseTypeId: string;
  code: string;
  name: string;
  description: string | null;
  status: CourseTypeStatus;
  hasBeenUsed: boolean;
};

export type CourseTypeListFilters = {
  search: string | null;
  status: CourseTypeStatus | null;
  skip: number;
  take: number;
};

export type CreateCourseTypeInput = {
  code: string;
  name: string;
  description: string | null;
  status: CourseTypeStatus;
};

export type UpdateCourseTypeInput = Partial<CreateCourseTypeInput>;
