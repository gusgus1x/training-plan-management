import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import type { AuthenticatedPrincipal } from "../auth/types";
import { getPrismaClient } from "../database/prisma";
import { getEmployee19Rank } from "../employeeMasterData";
import { employeeInclude, loadPlanScope, loadTargetStandards, matchTargetAgainst } from "./repository";
import type { Nominee, NomineeField } from "./types";

/**
 * A head sending their people to a course. The ladder is HIERARCHY_19_RANKS: rank 1 is the
 * president, 12 the section head, and a head may only send someone ranked strictly below them
 * (a bigger number), in any company - some heads look after several. What they send waits for HRD
 * like any other request.
 */

/** The lowest rank that may send anyone: Section Head. */
export const LOWEST_NOMINATOR_RANK = 12;

type RankedEmployee = Prisma.employeeGetPayload<{ include: typeof employeeInclude }>;

export const rankOf = (employee: Pick<RankedEmployee, "position" | "employee_level">) =>
  getEmployee19Rank({
    positionCode: employee.position?.position_code,
    positionName: employee.position?.position_name_en || employee.position?.position_name_th,
    levelCode: employee.employee_level?.level_code,
    levelKey: employee.employee_level?.level_key,
    levelName: employee.employee_level?.level_name_en || employee.employee_level?.level_name_th,
  });

/** Whether a head of `nominatorRank` may send someone of `nomineeRank`. */
export const mayNominate = (nominatorRank: number, nomineeRank: number) =>
  nominatorRank <= LOWEST_NOMINATOR_RANK && nomineeRank > nominatorRank;

const forbidden = (message: string) => new ApiError({ code: "FORBIDDEN", message, status: 403 });

const findCaller = (principal: AuthenticatedPrincipal) => {
  const keys = [
    principal.employeeUserId ? { user_id: principal.employeeUserId } : null,
    principal.employeeId ? { employee_id: BigInt(principal.employeeId) } : null,
  ].filter((key): key is NonNullable<typeof key> => key !== null);
  if (!keys.length) return Promise.resolve(null);
  return getPrismaClient().employee.findFirst({ where: { OR: keys }, include: employeeInclude });
};

/** Enrollments that already hold a seat; sending the same person again would reset theirs to pending. */
const HOLDS_A_SEAT = ["PENDING", "APPROVED"];

const nameOf = (employee: RankedEmployee) =>
  `${employee.first_name_th || ""} ${employee.last_name_th || ""}`.trim() ||
  `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim() ||
  employee.user_id;

/** The first value given is the label; every value given, including that one, is searchable. */
const field = (...values: Array<string | null | undefined>): NomineeField => {
  const present = [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
  return { label: present[0] ?? "", values: present };
};

/**
 * Who this caller may send to the given batch. With no batch it only answers whether they may send
 * anyone at all, which is what decides if the button shows.
 */
export const listNominees = async (principal: AuthenticatedPrincipal, planId: string | null) => {
  const caller = principal.role === "EMPLOYEE" ? await findCaller(principal) : null;
  const callerRank = caller ? rankOf(caller) : 99;
  const canNominate = caller !== null && callerRank <= LOWEST_NOMINATOR_RANK;
  if (!canNominate || !planId) return { canNominate, nominees: [] as Nominee[] };

  const db = getPrismaClient();
  const plan = await loadPlanScope(db, BigInt(planId));

  const [employees, standards, seated] = await Promise.all([
    db.employee.findMany({
      where: {
        employment_status: "ACTIVE",
        user_id: { not: caller.user_id },
        // Any company, since some heads look after several; a factory's own course still only
        // takes that factory's people, which create() enforces too.
        ...(plan.companyId !== null ? { company_id: plan.companyId } : {}),
      },
      include: employeeInclude,
      orderBy: [{ first_name_th: "asc" }, { last_name_th: "asc" }],
    }),
    loadTargetStandards(db, plan.courseId),
    db.training_enrollment.findMany({
      where: { plan_id: BigInt(planId), approval_status: { in: HOLDS_A_SEAT } },
      select: { employee_user_id: true },
    }),
  ]);
  const seatedIds = new Set(seated.map((row) => row.employee_user_id));

  const nominees: Nominee[] = employees
    .filter((employee) => mayNominate(callerRank, rankOf(employee)))
    .map((employee) => ({
      employeeUserId: employee.user_id,
      employeeCode: employee.employee_code ?? "",
      name: nameOf(employee),
      position: employee.position?.position_name_th || employee.position?.position_name_en || "",
      // One label per company so the list is not the same company three times over, but the code
      // and both full names all still match a search.
      company: field(employee.company?.company_code, employee.company?.company_name_th, employee.company?.company_name_en),
      division: field(employee.division?.division_name_th, employee.division?.division_name_en),
      department: field(employee.department?.department_name_th, employee.department?.department_name_en),
      section: field(employee.section?.section_name_th, employee.section?.section_name_en),
      person: field(
        nameOf(employee),
        `${employee.first_name_en || ""} ${employee.last_name_en || ""}`,
        employee.employee_code,
      ),
      outOfTarget: matchTargetAgainst(standards, employee).targetMatchStatus !== "MATCHED",
      alreadyEnrolled: seatedIds.has(employee.user_id),
    }));
  return { canNominate, nominees };
};

/** The server-side guard behind a head's send: strictly lower rank, not already seated. */
export const assertCanNominate = async (
  principal: AuthenticatedPrincipal,
  input: { planId: string; employeeId: string; employeeUserId?: string | null },
) => {
  const db = getPrismaClient();
  const caller = await findCaller(principal);
  const nominee = input.employeeUserId
    ? await db.employee.findUnique({ where: { user_id: input.employeeUserId }, include: employeeInclude })
    : await db.employee.findUnique({ where: { employee_id: BigInt(input.employeeId) }, include: employeeInclude });
  if (!caller || !nominee) throw forbidden("ไม่พบข้อมูลพนักงาน");
  if (!mayNominate(rankOf(caller), rankOf(nominee))) {
    throw forbidden("ส่งได้เฉพาะพนักงานที่ตำแหน่งต่ำกว่าตัวเอง");
  }
  const seated = await db.training_enrollment.findFirst({
    where: { plan_id: BigInt(input.planId), employee_user_id: nominee.user_id, approval_status: { in: HOLDS_A_SEAT } },
    select: { enrollment_id: true },
  });
  if (seated) {
    throw new ApiError({ code: "ALREADY_ENROLLED", message: "พนักงานคนนี้ลงทะเบียนรอบนี้แล้ว", status: 409 });
  }
  return nominee.user_id;
};
