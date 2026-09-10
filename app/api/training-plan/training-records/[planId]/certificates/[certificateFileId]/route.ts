import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../lib/auth/guard";
import { certificateService, type CertificateService } from "../../../../../../lib/certificates/service";

type Dependencies = { auth?: ProtectedRouteOptions; service?: CertificateService };
type RouteContext = { params: Promise<{ planId: string; certificateFileId: string }> };

const hrdOnly = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

/** Removes one uploaded file from the draft. The plan-level DELETE discards the whole batch; this
 *  one takes a single file out, which is what the bin button on a card means. */
export const createRemoveCertificateFileHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (_request: NextRequest, principal, { params }: RouteContext) => {
    const { planId, certificateFileId } = await params;
    const view = await (dependencies.service ?? certificateService).removeDraftFile(
      planId,
      certificateFileId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(view);
  }, hrdOnly(dependencies.auth));

export const DELETE = createRemoveCertificateFileHandler();
