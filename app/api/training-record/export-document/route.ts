import { type NextRequest, NextResponse } from "next/server";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { resolveCompanyLetterhead } from "../../../lib/trainingRecord/companyLetterheadConfig";
import {
  generateTrainingRecordDocx,
  SAMPLE_EMPLOYEE_DATA,
  SAMPLE_COURSES_DATA,
  SAMPLE_MULTIPAGE_COURSES_DATA,
  type EmployeeDocumentData,
  type CourseDocumentItem,
} from "../../../lib/trainingRecord/recordDocxGenerator";
import { trainingRecordRequestRepository } from "../../../lib/trainingRecordRequests/repository";
import { getPrismaClient } from "../../../lib/database/prisma";

export const createExportDocumentHandler = (options: { auth?: ProtectedRouteOptions } = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      try {
        const searchParams = request.nextUrl.searchParams;
        const requestedCompany = searchParams.get("company") || principal.companyCode || "ATA";
        const company = resolveCompanyLetterhead(requestedCompany);
        const isTest = searchParams.get("isTest") === "true";
        const isMultiPage =
          searchParams.get("multipage") === "true" || searchParams.get("sample") === "multipage";
        const requestId = searchParams.get("requestId");
        const format = (searchParams.get("format") || "docx").toLowerCase();

        let employeeData: EmployeeDocumentData = {
          companyCode: company.code,
        };
        let coursesData: CourseDocumentItem[] = [];

        // If explicit test without multi-page, use basic sample dataset
        if (isTest && !isMultiPage) {
          employeeData = {
            ...SAMPLE_EMPLOYEE_DATA,
            companyCode: company.code,
          };
          coursesData = SAMPLE_COURSES_DATA;
        } else {
          const db = getPrismaClient();
          let emp: any = null;

          if (requestId) {
            const reqRecord = await trainingRecordRequestRepository.findById(requestId);
            if (reqRecord) {
              emp = await db.employee.findFirst({
                where: {
                  OR: [
                    { user_id: reqRecord.employeeUserId },
                    ...(reqRecord.employeeCode ? [{ employee_code: reqRecord.employeeCode }] : []),
                  ],
                },
                include: {
                  position: true,
                  department: true,
                  division: true,
                  section: true,
                  organization_function: true,
                  company: true,
                },
              });

              if (!emp) {
                employeeData = {
                  employeeId: reqRecord.employeeCode || reqRecord.employeeUserId,
                  name: reqRecord.employeeName,
                  position: reqRecord.positionName || "-",
                  department: reqRecord.departmentName || "-",
                  division: "-",
                  section: "-",
                  workStartDate: null,
                  companyCode: reqRecord.companyCode || company.code,
                };
              }
            }
          }

          if (!emp) {
            const lookupUserIds = [
              principal.employeeUserId,
              principal.userId,
            ].filter((id): id is string => Boolean(id));

            emp = await db.employee.findFirst({
              where: {
                OR: [
                  { user_id: { in: lookupUserIds } },
                  ...(principal.employeeCode ? [{ employee_code: principal.employeeCode }] : []),
                  ...(principal.employeeId ? [{ employee_id: BigInt(principal.employeeId) }] : []),
                ],
              },
              include: {
                position: true,
                department: true,
                division: true,
                section: true,
                organization_function: true,
                company: true,
              },
            });
          }

          if (emp) {
            const prefix = emp.title_th || emp.title_en || "";
            const nameTh = `${prefix ? prefix : ""}${emp.first_name_th || ""} ${emp.last_name_th || ""}`.trim();
            const nameEn = `${prefix ? prefix + " " : ""}${emp.first_name_en || ""} ${emp.last_name_en || ""}`.trim();

            employeeData = {
              employeeId: emp.employee_code || principal.employeeCode || "-",
              name: nameTh || nameEn || principal.displayName || principal.username,
              position:
                emp.position?.position_name_th ||
                emp.position?.position_name_en ||
                principal.positionName ||
                "-",
              department:
                emp.organization_function?.function_name_th ||
                emp.organization_function?.function_name_en ||
                emp.department?.department_name_th ||
                emp.department?.department_name_en ||
                principal.departmentName ||
                "-",
              division:
                emp.division?.division_name_th ||
                emp.division?.division_name_en ||
                principal.divisionName ||
                "-",
              section:
                emp.section?.section_name_th ||
                emp.section?.section_name_en ||
                principal.sectionName ||
                "-",
              workStartDate: emp.hire_date || (principal.startDate ? new Date(principal.startDate) : null),
              companyCode: emp.company?.company_code || company.code,
            };
          } else {
            employeeData = {
              employeeId: principal.employeeCode || "-",
              name: principal.displayName || principal.username,
              position: principal.positionName || "-",
              department: principal.departmentName || "-",
              division: principal.divisionName || "-",
              section: principal.sectionName || "-",
              workStartDate: principal.startDate ? new Date(principal.startDate) : null,
              companyCode: principal.companyCode || company.code,
            };
          }

          // Query completed training courses for this employee
          const userIds = [
            emp?.user_id,
            principal.employeeUserId,
            principal.userId,
          ].filter((id): id is string => Boolean(id));

          const empIds = [
            emp?.employee_id,
            principal.employeeId ? BigInt(principal.employeeId) : null,
          ].filter((id): id is bigint => id !== null && id !== undefined);

          const enrollmentConditions: any[] = [];
          if (userIds.length > 0) {
            enrollmentConditions.push({ employee_user_id: { in: userIds } });
          }
          if (empIds.length > 0) {
            enrollmentConditions.push({ employee: { employee_id: { in: empIds } } });
          }

          if (isMultiPage) {
            coursesData = SAMPLE_MULTIPAGE_COURSES_DATA;
          } else if (enrollmentConditions.length > 0) {
            const enrollments = await db.training_enrollment.findMany({
              where: {
                AND: [
                  { OR: enrollmentConditions },
                  {
                    OR: [
                      { attendance: { attendance_status: "PRESENT" } },
                      { training_result: { isNot: null } },
                    ],
                  },
                ],
              },
              include: {
                attendance: true,
                training_plan: {
                  include: {
                    training_plan_oap: {
                      include: {
                        course: true,
                        instructor: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                training_plan: {
                  start_datetime: "asc",
                },
              },
            });

            coursesData = enrollments.map((en, index) => {
              const plan = en.training_plan;
              const oap = plan?.training_plan_oap;
              const courseTitle =
                oap?.course_name_snapshot ||
                oap?.course?.course_name ||
                plan?.plan_name ||
                "-";
              const instructorRel = oap?.instructor
                ? `${oap.instructor.first_name || ""} ${oap.instructor.last_name || ""}`.trim()
                : "";
              const instructor =
                oap?.instructor_name_text?.trim() ||
                instructorRel ||
                oap?.provider_name_text?.trim() ||
                plan?.venue?.trim() ||
                "-";

              return {
                seqNo: index + 1,
                startDate: plan?.start_datetime ?? null,
                endDate: plan?.end_datetime ?? null,
                courseTitle,
                instructor,
              };
            });
          }
        }

        // Generate the Word .docx file
        const result = await generateTrainingRecordDocx({
          companyCode: company.code,
          employee: employeeData,
          courses: coursesData,
          isTest,
          isMultiPage,
        });

        const encodedFileName = encodeURIComponent(result.fileName);

        return new NextResponse(new Uint8Array(result.buffer), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      } catch (error: any) {
        console.error("Export document error:", error);
        return NextResponse.json(
          {
            ok: false,
            message: error?.message || "Failed to generate training record document",
          },
          { status: 500 },
        );
      }
    },
    { ...options.auth, allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const },
  );

export const GET = createExportDocumentHandler();
export const POST = createExportDocumentHandler();
