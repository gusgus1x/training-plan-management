import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { certificateService, type CertificateService } from "../../../../lib/certificates/service";
import { openCertificateFile } from "../../../../lib/certificates/storage";

type Dependencies = { auth?: ProtectedRouteOptions; service?: CertificateService };
type RouteContext = { params: Promise<{ certificateFileId: string }> };

/**
 * The only way certificate bytes leave the server. Employees reach it for their own certificate,
 * HRD for the ones in their scope - the check lives in the repository, not here.
 */
export const createReadCertificateFileHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal, { params }: RouteContext) => {
      const { certificateFileId } = await params;

      const file = await (dependencies.service ?? certificateService).loadFileForPrincipal(certificateFileId, {
        role: principal.role,
        companyId: principal.companyId,
        employeeId: principal.employeeId,
        employeeUserId: principal.employeeUserId,
      });

      const download = request.nextUrl.searchParams.get("download") === "1";
      const stream = Readable.toWeb(openCertificateFile(file.storagePath)) as ReadableStream<Uint8Array>;

      // NextResponse, not a bare Response, so the guard still applies no-store / Vary: Cookie and
      // rolls the session cookie on the way out.
      return new NextResponse(stream, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(file.fileSizeBytes),
          // filename* is required: these names are Thai.
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
          "X-Content-Type-Options": "nosniff",
          // A PDF can carry JavaScript. Rendered same-origin, this stops it reaching the session.
          "Content-Security-Policy": "default-src 'none'",
        },
      });
    },
    { ...dependencies.auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const },
  );

export const GET = createReadCertificateFileHandler();
