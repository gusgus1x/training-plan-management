import { ApiError } from "../api/errors";
import { readOptionalString, readRequiredString, type InputObject } from "../api/validation";
import type { CourseListFilters, CreateCourseInput, UpdateCourseInput } from "./types";

export const readOptionalNumber = (input: InputObject, field: string): number | null => {
  const value = input[field];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }
  return null;
};

const hasOwn = (input: InputObject, field: string) => Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) => new ApiError({ code: "INVALID_INPUT", message: "The submitted course data is invalid", status: 400, details: { field, reason } });

const status = (value: unknown, fallback?: CreateCourseInput["status"]): CreateCourseInput["status"] => {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string" || !["Active", "Draft", "Inactive"].includes(value)) throw invalid("status", "Status must be Active, Draft, or Inactive");
  return value as CreateCourseInput["status"];
};

const arrayString = (input: InputObject, field: string): string[] => {
  const value = input[field];
  if (!Array.isArray(value)) return [];
  return value.filter(item => typeof item === "string");
};

const parseTargetOrgScopes = (input: InputObject): CreateCourseInput["targetOrgScopes"] => {
  const value = input.targetOrgScopes;
  if (!Array.isArray(value)) return undefined;
  const scopes: NonNullable<CreateCourseInput["targetOrgScopes"]> = [];
  for (const item of value) {
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      scopes.push({
        functionId: typeof obj.functionId === "string" && obj.functionId ? obj.functionId : null,
        divisionId: typeof obj.divisionId === "string" && obj.divisionId ? obj.divisionId : null,
        departmentId: typeof obj.departmentId === "string" && obj.departmentId ? obj.departmentId : null,
        sectionId: typeof obj.sectionId === "string" && obj.sectionId ? obj.sectionId : null,
      });
    }
  }
  return scopes.length > 0 ? scopes : undefined;
};

export const parseCreateCourse = (input: InputObject): CreateCourseInput => ({
  courseNameTh: readRequiredString(input, "courseNameTh", { maxLength: 255 }),
  courseNameEn: readOptionalString(input, "courseNameEn", { maxLength: 255 }) || "",
  objective: readOptionalString(input, "objective") || "",
  learningContent: readOptionalString(input, "learningContent") || "",
  targetGroup: readOptionalString(input, "targetGroup") || "",
  methodology: readOptionalString(input, "methodology") || "",
  durationHours: readOptionalNumber(input, "durationHours") || 0,
  validityMonths: readOptionalNumber(input, "validityMonths"),
  preAssessmentId: readOptionalString(input, "preAssessmentId"),
  postAssessmentId: readOptionalString(input, "postAssessmentId"),
  evaluationFormId: readOptionalString(input, "evaluationFormId"),
  evaluationFormAfter30DayId: readOptionalString(input, "evaluationFormAfter30DayId"),
  preTestLink: readOptionalString(input, "preTestLink", { maxLength: 2048 }),
  postTestLink: readOptionalString(input, "postTestLink", { maxLength: 2048 }),
  evaluationLink: readOptionalString(input, "evaluationLink", { maxLength: 2048 }),
  evaluationAfter30DayLink: readOptionalString(input, "evaluationAfter30DayLink", { maxLength: 2048 }),
  remark: readOptionalString(input, "remark") || "",
  status: status(input.status, "Active"),
  courseTypeId: readRequiredString(input, "courseTypeId"),
  courseGroupId: readRequiredString(input, "courseGroupId"),

  standardCode: readRequiredString(input, "standardCode", { maxLength: 50 }),
  standardName: readRequiredString(input, "standardName", { maxLength: 255 }),
  functionId: readOptionalString(input, "functionId"),
  divisionId: readOptionalString(input, "divisionId"),
  departmentId: readOptionalString(input, "departmentId"),
  sectionId: readOptionalString(input, "sectionId"),
  targetOrgScopes: parseTargetOrgScopes(input),
  targetCompanies: (() => {
    const companies = arrayString(input, "targetCompanies");
    if (companies.length === 0) throw invalid("targetCompanies", "Select at least one company");
    return companies;
  })(),
  targetPositions: arrayString(input, "targetPositions"),
  targetLevels: arrayString(input, "targetLevels"),
  standardYear: readOptionalNumber(input, "standardYear") || new Date().getFullYear(),
});

export const parseUpdateCourse = (input: InputObject): UpdateCourseInput => {
  const update: UpdateCourseInput = {};
  if (hasOwn(input, "courseNameTh")) update.courseNameTh = readRequiredString(input, "courseNameTh", { maxLength: 255 });
  if (hasOwn(input, "courseNameEn")) update.courseNameEn = readOptionalString(input, "courseNameEn", { maxLength: 255 }) ?? undefined;
  if (hasOwn(input, "objective")) update.objective = readOptionalString(input, "objective") ?? undefined;
  if (hasOwn(input, "learningContent")) update.learningContent = readOptionalString(input, "learningContent") ?? undefined;
  if (hasOwn(input, "targetGroup")) update.targetGroup = readOptionalString(input, "targetGroup") ?? undefined;
  if (hasOwn(input, "methodology")) update.methodology = readOptionalString(input, "methodology") ?? undefined;
  if (hasOwn(input, "durationHours")) update.durationHours = readOptionalNumber(input, "durationHours") ?? undefined;
  if (hasOwn(input, "validityMonths")) update.validityMonths = readOptionalNumber(input, "validityMonths");
  if (hasOwn(input, "preAssessmentId")) update.preAssessmentId = readOptionalString(input, "preAssessmentId");
  if (hasOwn(input, "postAssessmentId")) update.postAssessmentId = readOptionalString(input, "postAssessmentId");
  if (hasOwn(input, "evaluationFormId")) update.evaluationFormId = readOptionalString(input, "evaluationFormId");
  if (hasOwn(input, "evaluationFormAfter30DayId")) update.evaluationFormAfter30DayId = readOptionalString(input, "evaluationFormAfter30DayId");
  if (hasOwn(input, "preTestLink")) update.preTestLink = readOptionalString(input, "preTestLink", { maxLength: 2048 });
  if (hasOwn(input, "postTestLink")) update.postTestLink = readOptionalString(input, "postTestLink", { maxLength: 2048 });
  if (hasOwn(input, "evaluationLink")) update.evaluationLink = readOptionalString(input, "evaluationLink", { maxLength: 2048 });
  if (hasOwn(input, "evaluationAfter30DayLink")) update.evaluationAfter30DayLink = readOptionalString(input, "evaluationAfter30DayLink", { maxLength: 2048 });
  if (hasOwn(input, "remark")) update.remark = readOptionalString(input, "remark") ?? undefined;
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (hasOwn(input, "courseTypeId")) update.courseTypeId = readRequiredString(input, "courseTypeId");
  if (hasOwn(input, "courseGroupId")) update.courseGroupId = readRequiredString(input, "courseGroupId");
  
  if (hasOwn(input, "standardCode")) update.standardCode = readRequiredString(input, "standardCode", { maxLength: 50 });
  if (hasOwn(input, "standardName")) update.standardName = readRequiredString(input, "standardName", { maxLength: 255 });
  if (hasOwn(input, "functionId")) update.functionId = readOptionalString(input, "functionId");
  if (hasOwn(input, "divisionId")) update.divisionId = readOptionalString(input, "divisionId");
  if (hasOwn(input, "departmentId")) update.departmentId = readOptionalString(input, "departmentId");
  if (hasOwn(input, "sectionId")) update.sectionId = readOptionalString(input, "sectionId");
  if (hasOwn(input, "targetOrgScopes")) update.targetOrgScopes = parseTargetOrgScopes(input);
  if (hasOwn(input, "targetCompanies")) {
    const companies = arrayString(input, "targetCompanies");
    if (companies.length === 0) throw invalid("targetCompanies", "Select at least one company");
    update.targetCompanies = companies;
  }
  if (hasOwn(input, "targetPositions")) update.targetPositions = arrayString(input, "targetPositions");
  if (hasOwn(input, "targetLevels")) update.targetLevels = arrayString(input, "targetLevels");
  if (hasOwn(input, "standardYear")) update.standardYear = readOptionalNumber(input, "standardYear") ?? undefined;
  
  if (!Object.keys(update).length) throw invalid("body", "At least one editable field is required");
  return update;
};

export const parseCourseListFilters = (params: URLSearchParams): CourseListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const rawStatus = params.get("status");
  return { search, status: rawStatus ? status(rawStatus) : null };
};
