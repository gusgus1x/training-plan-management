export const COURSE_GROUP_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type CourseGroupStatus = (typeof COURSE_GROUP_STATUSES)[number];
export type CourseGroupRecord = { courseGroupId: string; code: string; name: string; status: CourseGroupStatus; lastCourseNumber: number };
export type CourseGroupListFilters = { search: string | null; status: CourseGroupStatus | null; skip: number; take: number };
export type CreateCourseGroupInput = { code: string; name: string; status: CourseGroupStatus };
export type UpdateCourseGroupInput = Partial<CreateCourseGroupInput>;
