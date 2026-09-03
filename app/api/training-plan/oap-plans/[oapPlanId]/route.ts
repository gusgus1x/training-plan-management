import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { recordDeleteAudit, recordUpdateAudit } from "../../../../lib/audit";
import { getPrismaClient } from "../../../../lib/database/prisma";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { oapPlanService, type OapPlanService } from "../../../../lib/trainingOap/service";
import { parseUpdateOapPlan } from "../../../../lib/trainingOap/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: OapPlanService };

const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

// HRD_CENTER is unscoped; a factory HRD is pinned to their own company. Same expression the POST
// route already uses for createOapPlan — update and delete simply never passed it through.
const scopeOf = (principal: { role: string; companyId: string | null }) =>
  principal.role === "HRD_FACTORY" ? principal.companyId : null;

export const createUpdateOapPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ oapPlanId: string }> }) => {
    const { oapPlanId } = await params;
    const input = parseUpdateOapPlan(await readJsonObject(request));
    const oapPlan = await (dependencies.service ?? oapPlanService).updateOapPlan(oapPlanId, input, principal.userId, scopeOf(principal));
    
    await recordUpdateAudit(
      request,
      principal,
      "oap_plan",
      oapPlanId,
      oapPlan.course?.courseNameTh || oapPlan.course?.courseNameEn || undefined,
      input
    );

    return apiSuccess({ oapPlan });
  }, writeOptions(dependencies.auth));

export const createDeleteOapPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ oapPlanId: string }> }) => {
    const { oapPlanId } = await params;
    
    // Snapshot course name before deletion for audit log
    const plan = await getPrismaClient().training_plan_oap.findUnique({
      where: { oap_plan_id: BigInt(oapPlanId) },
      include: { course: { select: { course_name: true } } },
    }).catch(() => null);

    const result = await (dependencies.service ?? oapPlanService).deleteOapPlan(oapPlanId, scopeOf(principal), {
      userId: principal.userId,
      username: principal.username,
      role: principal.role,
    });

    await recordDeleteAudit(
      request,
      principal,
      "oap_plan",
      oapPlanId,
      plan?.course?.course_name || undefined
    );

    return apiSuccess(result);
  }, writeOptions(dependencies.auth));

export const PUT = createUpdateOapPlanHandler();
export const DELETE = createDeleteOapPlanHandler();
