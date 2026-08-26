import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { cascadeDeleteTrainingPlans } from "../trainingPlanCascade";
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

const maxCourseCodeSeq = (courses: { course_code: string }[]) => {
  let maxSeq = 0;
  for (const c of courses) {
    const parts = c.course_code.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }
  return maxSeq;
};

// HRD_CENTER courses keep the original "<group>-<seq>" code, numbered from the
// group's own monotonic counter (last_course_number) so a code is never reused
// even after the highest-numbered course is deleted.
//
// HRD_FACTORY courses are prefixed with the creating company's code
// ("<company>-<group>-<seq>") and numbered independently per company, mirroring
// how employee codes are already scoped per company_id elsewhere in this app —
// each company gets its own code space starting at 000001, instead of sharing
// one running number with the center and every other company.
const generateCourseCode = async (
  tx: Prisma.TransactionClient,
  courseGroupId: bigint,
  companyId: bigint | null,
) => {
  const group = await tx.course_group.findUnique({
    where: { course_group_id: courseGroupId },
    select: { course_group_code: true, last_course_number: true },
  });
  if (!group) throw new Error("Course group not found");

  if (companyId === null) {
    const existingCourses = await tx.course.findMany({
      where: { course_group_id: courseGroupId },
      select: { course_code: true },
    });

    const maxSeq = maxCourseCodeSeq(existingCourses);
    const nextSeq = existingCourses.length === 0 ? 1 : Math.max(maxSeq + 1, (group.last_course_number ?? 0) + 1);

    await tx.course_group.update({
      where: { course_group_id: courseGroupId },
      data: { last_course_number: nextSeq },
    });

    return `${group.course_group_code.trim()}-${String(nextSeq).padStart(6, "0")}`;
  }

  const company = await tx.company.findUnique({
    where: { company_id: companyId },
    select: { company_code: true },
  });
  if (!company) throw new Error("Company not found");

  const companyCourses = await tx.course.findMany({
    where: { course_group_id: courseGroupId, company_id: companyId },
    select: { course_code: true },
  });
  const nextCompanySeq = maxCourseCodeSeq(companyCourses) + 1;

  return `${company.company_code.trim()}-${group.course_group_code.trim()}-${String(nextCompanySeq).padStart(6, "0")}`;
};

export type CourseRepository = ReturnType<typeof createCourseRepository>;
export const createCourseRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as PrismaClient;
  return {
    async list(filters: CourseListFilters, companyId: string | null) {
      const andList: Prisma.courseWhereInput[] = [];

      if (companyId) {
        andList.push({
          OR: [{ company_id: BigInt(companyId) }, { company_id: null }],
        });
      }

      if (filters.status) {
        andList.push({ status: filters.status.toUpperCase() });
      }

      if (filters.search) {
        andList.push({
          OR: [
            { course_code: { contains: filters.search } },
            { course_name: { contains: filters.search } },
          ],
        });
      }

      const where: Prisma.courseWhereInput = andList.length > 0 ? { AND: andList } : {};

      return withDatabaseErrorMapping(async () => {
        const rows = await db().course.findMany({
          where,
          include: {
            course_type: true,
            course_group: true,
            assessment_course_pre_assessment_idToassessment: { include: { assessment_series: true } },
            assessment_course_post_assessment_idToassessment: { include: { assessment_series: true } },
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
            preTest: row.assessment_course_pre_assessment_idToassessment?.assessment_series?.series_name || "",
            postTestId: row.post_assessment_id?.toString() || "",
            postTest: row.assessment_course_post_assessment_idToassessment?.assessment_series?.series_name || "",
            evaluationId: row.evaluation_form_id?.toString() || "",
            evaluation: row.evaluation_form?.form_name || "",
            evaluationAfter30DayId: row.evaluation_form_after_30day_id?.toString() || "",
            evaluationAfter30Day: row.evaluation_form_after_30day?.form_name || "",
            preTestLink: row.pre_test_link || undefined,
            postTestLink: row.post_test_link || undefined,
            evaluationLink: row.evaluation_link || undefined,
            evaluationAfter30DayLink: row.evaluation_after_30day_link || undefined,
            lifeCycleMonth: (row.validity_months !== null && row.validity_months !== undefined && row.validity_months > 0) ? row.validity_months.toString() : "0",
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

            const targetOrgScopes = row.course_standard_course.map(sc => ({
              functionId: sc.function_id?.toString() || undefined,
              divisionId: sc.division_id?.toString() || undefined,
              departmentId: sc.department_id?.toString() || undefined,
              sectionId: sc.section_id?.toString() || undefined,
              functionCode: sc.organization_function?.function_code || "",
              functionName: sc.organization_function
                ? sc.organization_function.function_name_en || sc.organization_function.function_name_th
                : "All Function",
              divisionCode: sc.division?.division_code || "",
              division: sc.division
                ? sc.division.division_name_en || sc.division.division_name_th
                : "",
              departmentCode: sc.department?.department_code || "",
              department: sc.department
                ? sc.department.department_name_en || sc.department.department_name_th
                : "",
              sectionCode: sc.section?.section_code || "",
              section: sc.section
                ? sc.section.section_name_en || sc.section.section_name_th
                : "",
            }));

            standards.push({
              id: std.standard_id.toString(),
              courseId: row.course_id.toString(),
              courseCode: row.course_code,
              courseName: row.course_name,
              functionId: stdCourse.function_id?.toString() || undefined,
              divisionId: stdCourse.division_id?.toString() || undefined,
              departmentId: stdCourse.department_id?.toString() || undefined,
              sectionId: stdCourse.section_id?.toString() || undefined,
              targetOrgScopes,
              functionCode: stdCourse.organization_function?.function_code || "",
              functionName: stdCourse.organization_function
                ? stdCourse.organization_function.function_name_en || stdCourse.organization_function.function_name_th
                : "All Function",
              divisionCode: stdCourse.division?.division_code || "",
              division: stdCourse.division
                ? stdCourse.division.division_name_en || stdCourse.division.division_name_th
                : "",
              departmentCode: stdCourse.department?.department_code || "",
              department: stdCourse.department
                ? stdCourse.department.department_name_en || stdCourse.department.department_name_th
                : "",
              sectionCode: stdCourse.section?.section_code || "",
              section: stdCourse.section
                ? stdCourse.section.section_name_en || stdCourse.section.section_name_th
                : "",
              companies: stdCourse.course_standard_target_company.map(c => c.company.company_code),
              positions: stdCourse.course_standard_target_position.map(p => p.position.position_name_en || p.position.position_name_th || p.position.position_code),
              levels: stdCourse.course_standard_target_level.map(l => l.employee_level.level_code || l.employee_level.level_code_en || l.employee_level.level_key),
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
          const courseCode = await generateCourseCode(tx, courseGroupId, safeBigInt(companyId));
          const course = await tx.course.create({
            data: {
              company_id: companyId ? safeBigInt(companyId) : null,
              course_type_id: safeBigInt(input.courseTypeId) ?? BigInt(0),
              course_group_id: courseGroupId,
              course_code: courseCode,
              course_name: input.courseNameTh,
              course_name_normalized: normalizeCourseName(input.courseNameTh),
              course_name_en: input.courseNameEn || null,
              description: input.remark ?? input.description ?? null,
              objective: input.objective,
              learning_content: input.learningContent,
              target_group: input.targetGroup || null,
              methodology: input.methodology || null,
              duration_hours: input.durationHours,
              validity_months: (input.validityMonths && input.validityMonths > 0) ? input.validityMonths : null,
              pre_assessment_id: safeBigInt(input.preAssessmentId),
              post_assessment_id: safeBigInt(input.postAssessmentId),
              evaluation_form_id: safeBigInt(input.evaluationFormId),
              evaluation_form_after_30day_id: safeBigInt(input.evaluationFormAfter30DayId),
              pre_test_link: input.preTestLink || null,
              post_test_link: input.postTestLink || null,
              evaluation_link: input.evaluationLink || null,
              evaluation_after_30day_link: input.evaluationAfter30DayLink || null,
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

          // 3. Determine target org scopes
          const scopes = (input.targetOrgScopes && input.targetOrgScopes.length > 0)
            ? input.targetOrgScopes
            : [{
                functionId: input.functionId,
                divisionId: input.divisionId,
                departmentId: input.departmentId,
                sectionId: input.sectionId,
              }];

          // Resolve target companies, positions, levels once
          let targetCompRecords: { company_id: bigint }[] = [];
          if (input.targetCompanies && input.targetCompanies.length > 0) {
            targetCompRecords = await tx.company.findMany({
              where: { company_code: { in: input.targetCompanies } },
              select: { company_id: true }
            });
          }

          let targetPosRecords: { position_id: bigint }[] = [];
          if (input.targetPositions && input.targetPositions.length > 0) {
            targetPosRecords = await tx.position.findMany({
              where: {
                OR: [
                  { position_name_en: { in: input.targetPositions } },
                  { position_name_th: { in: input.targetPositions } },
                  { position_code: { in: input.targetPositions } },
                ]
              },
              select: { position_id: true }
            });
          }

          let targetLvlRecords: { level_id: bigint }[] = [];
          if (input.targetLevels && input.targetLevels.length > 0) {
            targetLvlRecords = await tx.employee_level.findMany({
              where: {
                OR: [
                  { level_code: { in: input.targetLevels } },
                  { level_key: { in: input.targetLevels } },
                  { level_code_th: { in: input.targetLevels } },
                  { level_code_en: { in: input.targetLevels } },
                ]
              },
              select: { level_id: true }
            });
          }

          const primaryScope = scopes[0] || {
            functionId: input.functionId,
            divisionId: input.divisionId,
            departmentId: input.departmentId,
            sectionId: input.sectionId,
          };

          const stdCourse = await tx.course_standard_course.create({
            data: {
              standard_id: standard.standard_id,
              course_id: course.course_id,
              function_id: safeBigInt(primaryScope.functionId),
              division_id: safeBigInt(primaryScope.divisionId),
              department_id: safeBigInt(primaryScope.departmentId),
              section_id: safeBigInt(primaryScope.sectionId),
              created_at: new Date()
            }
          });

          if (targetCompRecords.length > 0) {
            await tx.course_standard_target_company.createMany({
              data: targetCompRecords.map(c => ({
                standard_course_id: stdCourse.standard_course_id,
                company_id: c.company_id
              }))
            });
          }

          if (targetPosRecords.length > 0) {
            await tx.course_standard_target_position.createMany({
              data: targetPosRecords.map(p => ({
                standard_course_id: stdCourse.standard_course_id,
                position_id: p.position_id
              }))
            });
          }

          if (targetLvlRecords.length > 0) {
            await tx.course_standard_target_level.createMany({
              data: targetLvlRecords.map(l => ({
                standard_course_id: stdCourse.standard_course_id,
                level_id: l.level_id
              }))
            });
          }

          return { courseId: course.course_id.toString(), courseCode };
        });
      });
    },

    async update(id: string, input: UpdateCourseInput, userId: string, companyId: string | null = null) {
      return withDatabaseErrorMapping(async () => {
        return await db().$transaction(async (tx) => {
          if (companyId) {
            const current = await tx.course.findUniqueOrThrow({
              where: { course_id: BigInt(id) },
              select: { company_id: true },
            });
            if (current.company_id?.toString() !== companyId) {
              throw new ApiError({ code: "FORBIDDEN", message: "Factory users cannot modify courses created by HRD Center or other factories", status: 403 });
            }
          }

          // Update Course
          const courseData: any = { updated_by: safeBigInt(userId) ?? BigInt(0), updated_at: new Date() };
          if (input.courseNameTh !== undefined) {
            courseData.course_name = input.courseNameTh;
            courseData.course_name_normalized = normalizeCourseName(input.courseNameTh);
          }
          if (input.courseNameEn !== undefined) courseData.course_name_en = input.courseNameEn || null;
          if (input.remark !== undefined || input.description !== undefined) {
            courseData.description = input.remark ?? input.description ?? null;
          }
          if (input.objective !== undefined) courseData.objective = input.objective;
          if (input.learningContent !== undefined) courseData.learning_content = input.learningContent;
          if (input.targetGroup !== undefined) courseData.target_group = input.targetGroup || null;
          if (input.methodology !== undefined) courseData.methodology = input.methodology || null;
          if (input.durationHours !== undefined) courseData.duration_hours = input.durationHours;
          if (input.validityMonths !== undefined) courseData.validity_months = (input.validityMonths && input.validityMonths > 0) ? input.validityMonths : null;
          if (input.preAssessmentId !== undefined) courseData.pre_assessment_id = safeBigInt(input.preAssessmentId);
          if (input.postAssessmentId !== undefined) courseData.post_assessment_id = safeBigInt(input.postAssessmentId);
          if (input.evaluationFormId !== undefined) courseData.evaluation_form_id = safeBigInt(input.evaluationFormId);
          if (input.evaluationFormAfter30DayId !== undefined) courseData.evaluation_form_after_30day_id = safeBigInt(input.evaluationFormAfter30DayId);
          if (input.preTestLink !== undefined) courseData.pre_test_link = input.preTestLink || null;
          if (input.postTestLink !== undefined) courseData.post_test_link = input.postTestLink || null;
          if (input.evaluationLink !== undefined) courseData.evaluation_link = input.evaluationLink || null;
          if (input.evaluationAfter30DayLink !== undefined) courseData.evaluation_after_30day_link = input.evaluationAfter30DayLink || null;
          if (input.status !== undefined) courseData.status = input.status.toUpperCase();
          if (input.courseTypeId !== undefined) courseData.course_type_id = safeBigInt(input.courseTypeId);
          if (input.courseGroupId !== undefined) {
            const newCourseGroupId = safeBigInt(input.courseGroupId) ?? BigInt(0);
            const current = await tx.course.findUniqueOrThrow({
              where: { course_id: BigInt(id) },
              select: { course_group_id: true, company_id: true },
            });
            if (newCourseGroupId !== current.course_group_id) {
              // Data Dictionary V6.2: changing a course's group requires a new system-generated
              // course_code; the old code is never reused.
              courseData.course_group_id = newCourseGroupId;
              courseData.course_code = await generateCourseCode(tx, newCourseGroupId, current.company_id);
            }
          }

          await tx.course.update({
            where: { course_id: BigInt(id) },
            data: courseData
          });

          // Handle Standard Update
          const existingStdCourses = await tx.course_standard_course.findMany({
            where: { course_id: BigInt(id) },
            select: { standard_course_id: true, standard_id: true }
          });

          if (existingStdCourses.length > 0) {
            const standardId = existingStdCourses[0].standard_id;
            const standardData: any = { updated_by: safeBigInt(userId) ?? BigInt(0), updated_at: new Date() };
            if (input.standardCode !== undefined) standardData.standard_code = input.standardCode;
            if (input.standardName !== undefined) standardData.standard_name = input.standardName;
            if (input.status !== undefined) standardData.status = input.status.toUpperCase();
            if (input.standardYear !== undefined) standardData.standard_year = input.standardYear;

            await tx.course_standard.update({
              where: { standard_id: standardId },
              data: standardData
            });

            if (input.targetOrgScopes !== undefined || input.targetCompanies !== undefined || input.targetPositions !== undefined || input.targetLevels !== undefined || input.functionId !== undefined || input.divisionId !== undefined || input.departmentId !== undefined || input.sectionId !== undefined) {
              const scopes = input.targetOrgScopes !== undefined
                ? (input.targetOrgScopes.length > 0 ? input.targetOrgScopes : [{ functionId: null, divisionId: null, departmentId: null, sectionId: null }])
                : (input.functionId !== undefined || input.divisionId !== undefined || input.departmentId !== undefined || input.sectionId !== undefined)
                ? [{
                    functionId: input.functionId ?? null,
                    divisionId: input.divisionId ?? null,
                    departmentId: input.departmentId ?? null,
                    sectionId: input.sectionId ?? null,
                  }]
                : null;

              if (scopes !== null) {
                // Delete old standard courses and children
                const oldStdCourseIds = existingStdCourses.map(sc => sc.standard_course_id);
                await tx.course_standard_target_company.deleteMany({ where: { standard_course_id: { in: oldStdCourseIds } } });
                await tx.course_standard_target_position.deleteMany({ where: { standard_course_id: { in: oldStdCourseIds } } });
                await tx.course_standard_target_level.deleteMany({ where: { standard_course_id: { in: oldStdCourseIds } } });
                await tx.course_standard_course.deleteMany({ where: { course_id: BigInt(id) } });

                // Target companies / positions / levels to attach
                const targetCompanies = input.targetCompanies;
                const targetPositions = input.targetPositions;
                const targetLevels = input.targetLevels;

                let targetCompRecords: { company_id: bigint }[] = [];
                if (targetCompanies && targetCompanies.length > 0) {
                  targetCompRecords = await tx.company.findMany({
                    where: { company_code: { in: targetCompanies } },
                    select: { company_id: true }
                  });
                }

                let targetPosRecords: { position_id: bigint }[] = [];
                if (targetPositions && targetPositions.length > 0) {
                  targetPosRecords = await tx.position.findMany({
                    where: {
                      OR: [
                        { position_name_en: { in: targetPositions } },
                        { position_name_th: { in: targetPositions } },
                        { position_code: { in: targetPositions } },
                      ]
                    },
                    select: { position_id: true }
                  });
                }

                let targetLvlRecords: { level_id: bigint }[] = [];
                if (targetLevels && targetLevels.length > 0) {
                  targetLvlRecords = await tx.employee_level.findMany({
                    where: {
                      OR: [
                        { level_code: { in: targetLevels } },
                        { level_key: { in: targetLevels } },
                        { level_code_th: { in: targetLevels } },
                        { level_code_en: { in: targetLevels } },
                      ]
                    },
                    select: { level_id: true }
                  });
                }

                const primaryScope = scopes[0];
                const newStdCourse = await tx.course_standard_course.create({
                  data: {
                    standard_id: standardId,
                    course_id: BigInt(id),
                    function_id: safeBigInt(primaryScope.functionId),
                    division_id: safeBigInt(primaryScope.divisionId),
                    department_id: safeBigInt(primaryScope.departmentId),
                    section_id: safeBigInt(primaryScope.sectionId),
                    created_at: new Date()
                  }
                });

                if (targetCompRecords.length > 0) {
                  await tx.course_standard_target_company.createMany({
                    data: targetCompRecords.map(c => ({
                      standard_course_id: newStdCourse.standard_course_id,
                      company_id: c.company_id
                    }))
                  });
                }

                if (targetPosRecords.length > 0) {
                  await tx.course_standard_target_position.createMany({
                    data: targetPosRecords.map(p => ({
                      standard_course_id: newStdCourse.standard_course_id,
                      position_id: p.position_id
                    }))
                  });
                }

                if (targetLvlRecords.length > 0) {
                  await tx.course_standard_target_level.createMany({
                    data: targetLvlRecords.map(l => ({
                      standard_course_id: newStdCourse.standard_course_id,
                      level_id: l.level_id
                    }))
                  });
                }
              }
            }
          }

          return { courseId: id };
        });
      });
    },

    async delete(id: string, companyId: string | null = null) {
      return withDatabaseErrorMapping(async () => {
        const courseId = BigInt(id);
        return await db().$transaction(
          async (tx) => {
          if (companyId) {
            const current = await tx.course.findUniqueOrThrow({
              where: { course_id: courseId },
              select: { company_id: true },
            });
            if (current.company_id?.toString() !== companyId) {
              throw new ApiError({ code: "FORBIDDEN", message: "Factory users cannot delete courses created by HRD Center or other factories", status: 403 });
            }
          }

          // 1. Cascade delete OAPs and rolling plans for this course first
          const oaps = await tx.training_plan_oap.findMany({
            where: { course_id: courseId },
            select: { oap_plan_id: true },
          });
          const oapIds = oaps.map((o) => o.oap_plan_id);

          if (oapIds.length > 0) {
            const plans = await tx.training_plan.findMany({
              where: { oap_plan_id: { in: oapIds } },
              select: { plan_id: true },
            });
            const planIds = plans.map((p) => p.plan_id);

            if (planIds.length > 0) {
              await cascadeDeleteTrainingPlans(tx, planIds);
            }

            await tx.training_plan_oap.deleteMany({
              where: { course_id: courseId },
            });
          }

          // 2. Unlink standard_course_id from any remaining enrollments and delete standard course targets
          const stdCourses = await tx.course_standard_course.findMany({
            where: { course_id: courseId },
            select: { standard_course_id: true, standard_id: true },
          });
          const stdCourseIds = stdCourses.map((sc) => sc.standard_course_id);

          if (stdCourseIds.length > 0) {
            await tx.training_enrollment.updateMany({
              where: { standard_course_id: { in: stdCourseIds } },
              data: { standard_course_id: null },
            });
            await tx.course_standard_target_company.deleteMany({
              where: { standard_course_id: { in: stdCourseIds } },
            });
            await tx.course_standard_target_position.deleteMany({
              where: { standard_course_id: { in: stdCourseIds } },
            });
            await tx.course_standard_target_level.deleteMany({
              where: { standard_course_id: { in: stdCourseIds } },
            });
            await tx.course_standard_course.deleteMany({
              where: { course_id: courseId },
            });
          }

          // 3. Unlink training need requests
          await tx.training_need_request.updateMany({
            where: { course_id: courseId },
            data: { course_id: null },
          }).catch(() => undefined);

          // 4. Delete the course itself
          await tx.course.delete({
            where: { course_id: courseId },
          });

          return { courseId: id, outcome: "DELETED" as const };
        }, { timeout: 20000 });
      });
    },
  };
};

export const courseRepository = createCourseRepository();
