import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../lib/api/response";
import { readJsonObject } from "../../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../lib/auth/guard";
import { certificateService, type CertificateService } from "../../../../../../lib/certificates/service";
import { parseConfirmCertificates } from "../../../../../../lib/certificates/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: CertificateService };
type RouteContext = { params: Promise<{ planId: string }> };

const hrdOnly = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

export const createConfirmCertificatesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: RouteContext) => {
    const { planId } = await params;
    const input = parseConfirmCertificates(await readJsonObject(request));

    const view = await (dependencies.service ?? certificateService).confirmCertificates(
      planId,
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
      { userId: principal.userId, username: principal.username, role: principal.role },
    );
    return apiSuccess(view);
  }, hrdOnly(dependencies.auth));

export const POST = createConfirmCertificatesHandler();
