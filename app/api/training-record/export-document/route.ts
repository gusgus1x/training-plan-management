import { type NextRequest, NextResponse } from "next/server";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { resolveCompanyLetterhead } from "../../../lib/trainingRecord/companyLetterheadConfig";
import {
  generateTrainingRecordDocx,
  SAMPLE_EMPLOYEE_DATA,
  SAMPLE_COURSES_DATA,
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
        const requestId = searchParams.get("requestId");
        const format = (searchParams.get("format") || "docx").toLowerCase();

        let employeeData: EmployeeDocumentData = {
          ...SAMPLE_EMPLOYEE_DATA,
          companyCode: company.code,
        };
        let coursesData: CourseDocumentItem[] = SAMPLE_COURSES_DATA;

        // If not explicit test, try to load real data
        if (!isTest) {
          if (requestId) {
            const reqRecord = await trainingRecordRequestRepository.findById(requestId);
            if (reqRecord) {
              employeeData = {
                employeeId: reqRecord.employeeCode || reqRecord.employeeUserId,
                name: reqRecord.employeeName,
                position: reqRecord.positionName || "-",
                department: reqRecord.departmentName || "-",
                division: reqRecord.departmentName || "ฝ่ายฝึกอบรม",
                section: "-",
                workStartDate: null,
                companyCode: reqRecord.companyCode || company.code,
              };
            }
          } else if (principal.employeeUserId) {
            // Load current user profile from DB
            try {
              const db = getPrismaClient();
              const emp = await db.employee.findUnique({
                where: { user_id: principal.employeeUserId },
                include: {
                  position: true,
                  department: true,
                  division: true,
                  section: true,
                },
              });

              if (emp) {
                const nameTh = `${emp.first_name_th || ""} ${emp.last_name_th || ""}`.trim();
                const nameEn = `${emp.first_name_en || ""} ${emp.last_name_en || ""}`.trim();
                employeeData = {
                  employeeId: emp.employee_code || principal.employeeCode,
                  name: nameTh || nameEn || principal.username,
                  position: emp.position?.position_name_th || emp.position?.position_name_en || "-",
                  department: emp.department?.department_name_th || emp.department?.department_name_en || "-",
                  division: emp.division?.division_name_th || emp.division?.division_name_en || "-",
                  section: emp.section?.section_name_th || emp.section?.section_name_en || "-",
                  workStartDate: emp.hire_date || null,
                  companyCode: company.code,
                };
              }
            } catch (err) {
              console.warn("Could not query logged-in employee, using fallback", err);
            }
          }
        }

        // Generate the Word .docx file
        const result = await generateTrainingRecordDocx({
          companyCode: company.code,
          employee: employeeData,
          courses: coursesData,
          isTest,
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
