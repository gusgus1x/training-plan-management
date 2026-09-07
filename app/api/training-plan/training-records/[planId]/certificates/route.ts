import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { ApiError } from "../../../../../lib/api/errors";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { certificateService, type CertificateService } from "../../../../../lib/certificates/service";
import { assertRequestSizeAllowed, MAX_FILES_PER_UPLOAD } from "../../../../../lib/certificates/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: CertificateService };
type RouteContext = { params: Promise<{ planId: string }> };

const hrdOnly = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

export const createListCertificatesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (_request: NextRequest, principal, { params }: RouteContext) => {
    const { planId } = await params;
    const view = await (dependencies.service ?? certificateService).loadPlanView(
      planId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(view);
  }, hrdOnly(dependencies.auth));

export const createUploadCertificatesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: RouteContext) => {
    const { planId } = await params;

    // Before formData(): it buffers the entire body into memory, so this is the only point where
    // an oversized upload can still be refused cheaply.
    assertRequestSizeAllowed(request.headers.get("content-length"));

    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      throw new ApiError({ code: "CERTIFICATE_UPLOAD_INVALID", message: "No files were uploaded.", status: 400 });
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new ApiError({
        code: "CERTIFICATE_UPLOAD_INVALID",
        message: `Too many files in one upload (max ${MAX_FILES_PER_UPLOAD}).`,
        status: 400,
      });
    }

    const uploads = await Promise.all(
      files.map(async (file) => ({ fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })),
    );

    const result = await (dependencies.service ?? certificateService).uploadCertificates(
      planId,
      uploads,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(result, 201);
  }, hrdOnly(dependencies.auth));

export const createDiscardCertificatesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (_request: NextRequest, principal, { params }: RouteContext) => {
    const { planId } = await params;
    const view = await (dependencies.service ?? certificateService).discardDraft(
      planId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(view);
  }, hrdOnly(dependencies.auth));

export const GET = createListCertificatesHandler();
export const POST = createUploadCertificatesHandler();
export const DELETE = createDiscardCertificatesHandler();
