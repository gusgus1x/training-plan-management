import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type { CourseListFilters, CreateCourseInput, UpdateCourseInput } from "./types";
import type { WorkflowCourse, WorkflowStandard } from "../trainingWorkflow";

type DatabaseClient = Pick<PrismaClient, "course" | "course_standard" | "course_standard_course" | "company">;

export const normalizeCourseName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const safeBigInt = (val: string | null | undefined): bigint | null => {
  if (!val) return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
};

// Data Dictionary V6.2: course_code = "{course_group_code}-{last_course_number, min 6 digits}",
// system-generated only. last_course_number is incremented atomically within the transaction,
// never decreased, never reused.
const generateCourseCode = async (tx: Prisma.TransactionClient, courseGroupId: bigint) => {
  const group = await tx.course_group.update({
    where: { course_group_id: courseGroupId },
    data: { last_course_number: { increment: 1 } },
    select: { course_group_code: true, last_course_number: true },
  });
  return `${group.course_group_code.trim()}-${String(group.last_course_number).padStart(6, "0")}`;
};

export type CourseRepository = ReturnType<typeof createCourseRepository>;
export const createCourseRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as PrismaClient;
  return {
    async list(filters: CourseListFilters, companyId: string | null) {
      const where: Prisma.courseWhereInput = {};
      if (companyId) {
        where.company_id = BigInt(companyId);
      }
      if (filters.status) where.status = filters.status.toUpperCase();
      if (filters.search) where.OR = [
        { course_code: { contains: filters.search } },
        { course_name: { contains: filters.search } },
      ];

      return withDatabaseErrorMapping(async () => {
        const rows = await db().course.findMany({
          where,
          include: {
            course_type: true,
            course_group: true,
            assessment_course_pre_assessment_idToassessment: true,
            assessment_course_post_assessment_idToassessment: true,
            evaluation_form: true,
            evaluation_form_after_30day: true,
            user_account_course_created_byTouser_account: true,
            company: true,
            course_standard_course: {
              include: {
                course_standard: true,
                course_standard_target_level: { include: { employee_level: true } },
                course_standard_target_position: { include: { position: true } },
                course_standard_target_company: { include: { company: true } },
                organization_function: true,
                division: true,
                department: true,
                section: true,
              }
            }
          },
          orderBy: { course_code: "asc" }
        });

        const courses: WorkflowCourse[] = [];
        const standards: WorkflowStandard[] = [];

        for (const row of rows) {
          const owner = row.company_id ? "FACTORY" : "CENTER";
          const ownerCompany = row.company?.company_code ?? "CENTER";
          
          courses.push({
            id: row.course_id.toString(),
            courseCode: row.course_code,
            courseNameTh: row.course_name,
            courseNameEn: row.course_name_en || "",
            objective: row.objective || "",
            learningContent: row.learning_content || "",
            targetGroup: row.target_group || "",
            methodology: row.methodology || "",
            preTestId: row.pre_assessment_id?.toString() || "",
            preTest: row.assessment_course_pre_assessment_idToassessment ? "Pre-test" : "",
            postTestId: row.post_assessment_id?.toString() || "",
            postTest: row.assessment_course_post_assessment_idToassessment ? "Post-test" : "",
            evaluationId: row.evaluation_form_id?.toString() || "",
            evaluation: row.evaluation_form?.form_name || "",
            evaluationAfter30DayId: row.evaluation_form_after_30day_id?.toString() || "",
            evaluationAfter30Day: row.evaluation_form_after_30day?.form_name || "",
            lifeCycleMonth: row.validity_months?.toString() || "12",
            remark: row.description || "",
            status: row.status === "ACTIVE" ? "Active" : row.status === "DRAFT" ? "Draft" : "Inactive",
            courseType: row.course_type.course_type_name,
            courseGroup: row.course_group.course_group_name,
            updatedAt: (row.updated_at || row.created_at).toISOString(),
            owner,
            ownerCompany,
            createdBy: row.created_by.toString()
          });

          if (row.course_standard_course.length > 0) {
            const stdCourse = row.course_standard_course[0];
            const std = stdCourse.course_standard;
            standards.push({
              id: std.standard_id.toString(),
              courseId: row.course_id.toString(),
              courseCode: row.course_code,
              courseName: row.course_name,
              functionCode: stdCourse.organization_function?.function_code || "",
              functionName: stdCourse.organization_function
                ? stdCourse.organization_function.function_name_en || stdCourse.organization_function.function_name_th
                : "All Function",
              division: stdCourse.division
                ? stdCourse.division.division_name_en || stdCourse.division.division_name_th
                : "",
              department: stdCourse.department
                ? stdCourse.department.department_name_en || stdCourse.department.department_name_th
                : "",
              section: stdCourse.section
                ? stdCourse.section.section_name_en || stdCourse.section.section_name_th
                : "",
              companies: stdCourse.course_standard_target_company.map(c => c.company.company_code),
              positions: stdCourse.course_standard_target_position.map(p => p.position.position_name_en || ""),
              levels: stdCourse.course_standard_target_level.map(l => l.employee_level.level_code),
              owner,
              ownerCompany,
            });
          }
        }

        return { courses, standards };
      });
    },

    async create(input: CreateCourseInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        return await db().$transaction(async (tx) => {
          // 1. Create course
          const courseGroupId = safeBigInt(input.courseGroupId) ?? BigInt(0);
          const courseCode = await generateCourseCode(tx, courseGroupId);
          const course = await tx.course.create({
            data: {
              company_id: companyId ? safeBigInt(companyId) : null,
              course_type_id: safeBigInt(input.courseTypeId) ?? BigInt(0),
              course_group_id: courseGroupId,
              course_code: courseCode,
              course_name: input.courseNameTh,
              course_name_normalized: normalizeCourseName(input.courseNameTh),
              course_name_en: input.courseNameEn || null,
              description: "",
              objective: input.objective,
              learning_content: input.learningContent,
              target_group: input.targetGroup || null,
              methodology: input.methodology || null,
              duration_hours: input.durationHours,
              validity_months: input.validityMonths,
              pre_assessment_id: safeBigInt(input.preAssessmentId),
              post_assessment_id: safeBigInt(input.postAssessmentId),
              evaluation_form_id: safeBigInt(input.evaluationFormId),
              evaluation_form_after_30day_id: safeBigInt(input.evaluationFormAfter30DayId),
              status: input.status.toUpperCase(),
              created_by: safeBigInt(userId) ?? BigInt(0),
              created_at: new Date(),
            }
          });

          // 2. Find or create standard (unique per year per company)
          let standard = await tx.course_standard.findFirst({
            where: {
              standard_year: input.standardYear,
              company_id: companyId ? safeBigInt(companyId) : null,
            }
          });

          if (!standard) {
            standard = await tx.course_standard.create({
              data: {
                company_id: companyId ? safeBigInt(companyId) : null,
                standard_year: input.standardYear,
                standard_code: input.standardCode,
                standard_name: input.standardName,
                status: "ACTIVE",
                created_by: safeBigInt(userId) ?? BigInt(0),
                created_at: new Date()
              }
            });
          }


          // 3. Link standard to course
          const stdCourse = await tx.course_standard_course.create({
            data: {
              standard_id: standard.standard_id,
              course_id: course.course_id,
              function_id: safeBigInt(input.functionId),
              division_id: safeBigInt(input.divisionId),
              department_id: safeBigInt(input.departmentId),
              section_id: safeBigInt(input.sectionId),
              created_at: new Date()
            }
          });

          // 3b. Create target companies
          if (input.targetCompanies && input.targetCompanies.length > 0) {
            const companies = await tx.company.findMany({
              where: { company_code: { in: input.targetCompanies } }
            });
            await tx.course_standard_target_company.createMany({
              data: companies.map(c => ({
                standard_course_id: stdCourse.standard_course_id,
                company_id: c.company_id
              }))
            });
          }

          // 4. Create target positions
          if (input.targetPositions && input.targetPositions.length > 0) {
            const positions = await tx.position.findMany({
              where: { position_name_en: { in: input.targetPositions } }
            });
            await tx.course_standard_target_position.createMany({
              data: positions.map(p => ({
                standard_course_id: stdCourse.standard_course_id,
                position_id: p.position_id
              }))
            });
          }

          // 5. Create target levels
          if (input.targetLevels && input.targetLevels.length > 0) {
            const levels = await tx.employee_level.findMany({
              where: { level_code: { in: input.targetLevels } }
            });
            await tx.course_standard_target_level.createMany({
              data: levels.map(l => ({
                standard_course_id: stdCourse.standard_course_id,
                level_id: l.level_id
              }))
            });
          }

          return { courseId: course.course_id.toString(), courseCode };
        });
      });
    },

    async update(id: string, input: UpdateCourseInput, userId: string) {
      return withDatabaseErrorMapping(async () => {
        return await db().$transaction(async (tx) => {
          // Update Course
          const courseData: any = { updated_by: safeBigInt(userId) ?? BigInt(0), updated_at: new Date() };
          if (input.courseNameTh !== undefined) {
            courseData.course_name = input.courseNameTh;
            courseData.course_name_normalized = normalizeCourseName(input.courseNameTh);
          }
          if (input.courseNameEn !== undefined) courseData.course_name_en = input.courseNameEn || null;
          if (input.objective !== undefined) courseData.objective = input.objective;
          if (input.learningContent !== undefined) courseData.learning_content = input.learningContent;
          if (input.targetGroup !== undefined) courseData.target_group = input.targetGroup || null;
          if (input.methodology !== undefined) courseData.methodology = input.methodology || null;
          if (input.durationHours !== undefined) courseData.duration_hours = input.durationHours;
          if (input.validityMonths !== undefined) courseData.validity_months = input.validityMonths;
          if (input.preAssessmentId !== undefined) courseData.pre_assessment_id = safeBigInt(input.preAssessmentId);
          if (input.postAssessmentId !== undefined) courseData.post_assessment_id = safeBigInt(input.postAssessmentId);
          if (input.evaluationFormId !== undefined) courseData.evaluation_form_id = safeBigInt(input.evaluationFormId);
          if (input.evaluationFormAfter30DayId !== undefined) courseData.evaluation_form_after_30day_id = safeBigInt(input.evaluationFormAfter30DayId);
          if (input.status !== undefined) courseData.status = input.status.toUpperCase();
          if (input.courseTypeId !== undefined) courseData.course_type_id = safeBigInt(input.courseTypeId);
          if (input.courseGroupId !== undefined) {
            const newCourseGroupId = safeBigInt(input.courseGroupId) ?? BigInt(0);
            const current = await tx.course.findUniqueOrThrow({
              where: { course_id: BigInt(id) },
              select: { course_group_id: true },
            });
            if (newCourseGroupId !== current.course_group_id) {
              // Data Dictionary V6.2: changing a course's group requires a new system-generated
              // course_code; the old code is never reused.
              courseData.course_group_id = newCourseGroupId;
              courseData.course_code = await generateCourseCode(tx, newCourseGroupId);
            }
          }

          await tx.course.update({
            where: { course_id: BigInt(id) },
            data: courseData
          });

          // Handle Standard Update
          const stdCourse = await tx.course_standard_course.findFirst({
            where: { course_id: BigInt(id) }
          });

          if (stdCourse) {
            const standardData: any = { updated_by: safeBigInt(userId) ?? BigInt(0), updated_at: new Date() };
            if (input.standardCode !== undefined) standardData.standard_code = input.standardCode;
            if (input.standardName !== undefined) standardData.standard_name = input.standardName;
            if (input.status !== undefined) standardData.status = input.status.toUpperCase();
            if (input.standardYear !== undefined) standardData.standard_year = input.standardYear;

            await tx.course_standard.update({
              where: { standard_id: stdCourse.standard_id },
              data: standardData
            });

            if (input.functionId !== undefined) {
              await tx.course_standard_course.update({
                where: { standard_course_id: stdCourse.standard_course_id },
                data: { function_id: safeBigInt(input.functionId) }
              });
            }

            if (input.divisionId !== undefined) {
              await tx.course_standard_course.update({
                where: { standard_course_id: stdCourse.standard_course_id },
                data: { division_id: safeBigInt(input.divisionId) }
              });
            }

            if (input.departmentId !== undefined) {
              await tx.course_standard_course.update({
                where: { standard_course_id: stdCourse.standard_course_id },
                data: { department_id: safeBigInt(input.departmentId) }
              });
            }

            if (input.sectionId !== undefined) {
              await tx.course_standard_course.update({
                where: { standard_course_id: stdCourse.standard_course_id },
                data: { section_id: safeBigInt(input.sectionId) }
              });
            }

            if (input.targetCompanies !== undefined) {
              await tx.course_standard_target_company.deleteMany({
                where: { standard_course_id: stdCourse.standard_course_id }
              });
              if (input.targetCompanies.length > 0) {
                const companies = await tx.company.findMany({
                  where: { company_code: { in: input.targetCompanies } }
                });
                await tx.course_standard_target_company.createMany({
                  data: companies.map(c => ({
                    standard_course_id: stdCourse.standard_course_id,
                    company_id: c.company_id
                  }))
                });
              }
            }

            if (input.targetPositions !== undefined) {
              await tx.course_standard_target_position.deleteMany({
                where: { standard_course_id: stdCourse.standard_course_id }
              });
              if (input.targetPositions.length > 0) {
                const positions = await tx.position.findMany({
                  where: { position_name_en: { in: input.targetPositions } }
                });
                await tx.course_standard_target_position.createMany({
                  data: positions.map(p => ({
                    standard_course_id: stdCourse.standard_course_id,
                    position_id: p.position_id
                  }))
                });
              }
            }

            if (input.targetLevels !== undefined) {
              await tx.course_standard_target_level.deleteMany({
                where: { standard_course_id: stdCourse.standard_course_id }
              });
              if (input.targetLevels.length > 0) {
                const levels = await tx.employee_level.findMany({
                  where: { level_code: { in: input.targetLevels } }
                });
                await tx.course_standard_target_level.createMany({
                  data: levels.map(l => ({
                    standard_course_id: stdCourse.standard_course_id,
                    level_id: l.level_id
                  }))
                });
              }
            }
          }

          return { courseId: id };
        });
      });
    }
  };
};

export const courseRepository = createCourseRepository();
