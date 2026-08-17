import type { PrismaClient } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type { OrgHierarchyUsageRow } from "./types";

type DatabaseClient = Pick<PrismaClient, "employee">;

export type OrgHierarchyRepository = ReturnType<typeof createOrgHierarchyRepository>;

export const createOrgHierarchyRepository = (client?: DatabaseClient) => {
  const database = () => client ?? getPrismaClient();
  return {
    async listUsage(): Promise<OrgHierarchyUsageRow[]> {
      return withDatabaseErrorMapping(async () => {
        const rows = await database().employee.findMany({
          where: { employment_status: "ACTIVE" },
          select: { company_id: true, division_id: true, department_id: true, section_id: true },
          distinct: ["company_id", "division_id", "department_id", "section_id"],
        });
        return rows.map((row) => ({
          companyId: row.company_id?.toString() ?? null,
          divisionId: row.division_id?.toString() ?? null,
          departmentId: row.department_id?.toString() ?? null,
          sectionId: row.section_id?.toString() ?? null,
        }));
      });
    },
  };
};

export const orgHierarchyRepository = createOrgHierarchyRepository();
