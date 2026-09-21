import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { getPrismaClient } from "../../../../lib/database/prisma";
import {
  getEmployee19Rank,
  getTargetApproverRank,
  getHierarchyRankInfo,
  toEnglishPositionName,
} from "../../../../lib/employeeMasterData";

export type EnrollmentApproverCandidate = {
  reviewerUserId: string;
  employeeUserId: string;
  employeeCode: string;
  name: string;
  position: string;
  rank: number;
  rankTitleEn: string;
  rankTitleTh: string;
  company: string;
  department: string;
  section: string;
};

type Dependencies = {
  auth?: ProtectedRouteOptions;
};

export const createListEnrollmentApproversHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (_request: NextRequest, principal) => {
      const companyId = principal.companyId;
      if (!companyId) {
        return apiSuccess({
          candidates: [],
          isPresident: false,
          requesterRank: 18,
          targetRank: 12,
        });
      }

      const db = getPrismaClient();

      // Find current employee info
      const callerEmp = await db.employee.findFirst({
        where: {
          OR: [
            principal.employeeUserId ? { user_id: principal.employeeUserId } : undefined,
            principal.employeeId ? { employee_id: BigInt(principal.employeeId) } : undefined,
          ].filter(Boolean) as any,
        },
        include: {
          position: true,
          employee_level: true,
        },
      });

      const requesterRank = callerEmp
        ? getEmployee19Rank({
            positionCode: callerEmp.position?.position_code,
            positionName: callerEmp.position?.position_name_en || callerEmp.position?.position_name_th,
            levelCode: callerEmp.employee_level?.level_code,
            levelKey: callerEmp.employee_level?.level_key,
            levelName: callerEmp.employee_level?.level_name_en || callerEmp.employee_level?.level_name_th,
          })
        : 18;

      if (requesterRank <= 1) {
        return apiSuccess({
          isPresident: true,
          requesterRank: 1,
          targetRank: 1,
          targetRankInfo: getHierarchyRankInfo(1),
          candidates: [],
        });
      }

      const targetRank = getTargetApproverRank(requesterRank);
      const targetRankInfo = getHierarchyRankInfo(targetRank);

      // Fetch active employees in same company (excluding self)
      const empCompanyId = callerEmp?.company_id ?? BigInt(companyId);
      const employees = await db.employee.findMany({
        where: {
          employment_status: "ACTIVE",
          company_id: empCompanyId,
          ...(callerEmp?.user_id ? { user_id: { not: callerEmp.user_id } } : {}),
        },
        include: {
          position: true,
          company: true,
          division: true,
          department: true,
          section: true,
          employee_level: true,
          user_account_user_account_employee_user_idToemployee: {
            select: { user_id: true, status: true },
          },
        },
        orderBy: [{ first_name_th: "asc" }, { last_name_th: "asc" }],
      });

      // Calculate ranks for all company employees
      const rankedEmployees = employees.map((emp) => {
        const rank = getEmployee19Rank({
          positionCode: emp.position?.position_code,
          positionName: emp.position?.position_name_en || emp.position?.position_name_th,
          levelCode: emp.employee_level?.level_code,
          levelKey: emp.employee_level?.level_key,
          levelName: emp.employee_level?.level_name_en || emp.employee_level?.level_name_th,
        });
        return { emp, rank };
      });

      // Filter by targetRank (Option 1: direct level)
      let eligible = rankedEmployees.filter((item) => item.rank === targetRank);

      // Fallback: If no exact targetRank exists in this company, find next available higher rank (< requesterRank)
      if (eligible.length === 0) {
        const higherAvailable = rankedEmployees
          .filter((item) => item.rank < requesterRank)
          .sort((a, b) => b.rank - a.rank); // highest rank number that is still < requesterRank (closest higher)
        if (higherAvailable.length > 0) {
          const closestRank = higherAvailable[0].rank;
          eligible = higherAvailable.filter((item) => item.rank === closestRank);
        }
      }

      // Resolve user_account for each eligible candidate
      const candidates: EnrollmentApproverCandidate[] = [];
      for (const item of eligible) {
        const emp = item.emp;
        const linkedAccounts = emp.user_account_user_account_employee_user_idToemployee || [];
        const activeLinked = linkedAccounts.find((a) => a.status === "ACTIVE") || linkedAccounts[0];

        let approverUserId = activeLinked?.user_id?.toString();
        if (!approverUserId) {
          // Fallback lookup by employee code or user_id
          const fallbackAcc = await db.user_account.findFirst({
            where: {
              OR: [
                { employee_user_id: emp.user_id },
                { username: emp.employee_code ?? "" },
              ],
            },
            select: { user_id: true },
          });
          if (fallbackAcc) {
            approverUserId = fallbackAcc.user_id.toString();
          }
        }

        if (approverUserId) {
          const rankInfo = getHierarchyRankInfo(item.rank);
          candidates.push({
            reviewerUserId: approverUserId,
            employeeUserId: emp.user_id,
            employeeCode: emp.employee_code ?? "",
            name:
              `${emp.first_name_th || ""} ${emp.last_name_th || ""}`.trim() ||
              `${emp.first_name_en || ""} ${emp.last_name_en || ""}`.trim() ||
              emp.user_id,
            position: toEnglishPositionName(emp.position),
            rank: item.rank,
            rankTitleEn: rankInfo?.nameEn || "",
            rankTitleTh: rankInfo?.nameTh || "",
            company: emp.company.company_code,
            department: emp.department?.department_name_th || emp.department?.department_name_en || "",
            section: emp.section?.section_name_th || emp.section?.section_name_en || "",
          });
        }
      }

      return apiSuccess({
        isPresident: false,
        requesterRank,
        targetRank,
        targetRankInfo,
        candidates,
      });
    },
    { ...dependencies.auth, allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const },
  );

export const GET = createListEnrollmentApproversHandler();
