import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../../lib/auth/guard";
import { buildEvaluationSummaryWorkbook } from "../../../../../../../lib/evaluationSummaryWorkbook";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../../lib/trainingForms/service";
import {
  parseEvaluationRespondentGroup,
  parseEvaluationTiming,
} from "../../../../../../../lib/trainingForms/validation";

export const runtime = "nodejs";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ planId: string; timing: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

const TEMPLATE_PATH = path.join(process.cwd(), "app", "Excel", "Evaluation_Form_Tem.xlsx");

/**
 * The evaluation report as the prepared workbook, charts and all.
 *
 * The template is read per request rather than held in memory: it is small, it changes whenever HRD
 * redesigns the report, and a cached copy would keep serving yesterday's layout.
 *
 * HRD only, like every other read of this data. The file carries every written comment, including
 * on a form small enough that the screen withholds them - a deliberate difference, and the reason
 * this route may never be opened up further.
 */
export const createExportEvaluationSummaryHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { planId, timing } = await params;
    const service = dependencies.service ?? trainingFormsService;
    const stage = parseEvaluationTiming(timing);
    const respondents = parseEvaluationRespondentGroup(request.nextUrl.searchParams.get("respondents"));
    const companyId = principal.role === "HRD_FACTORY" ? principal.companyId : null;

    const summary = await service.readEvaluationSummary(planId, stage, companyId, respondents);
    if (summary === null) {
      return NextResponse.json(
        { error: "หลักสูตรนี้ไม่ได้ตั้งแบบประเมินช่วงเวลานี้ไว้" },
        { status: 404 },
      );
    }
    const responses = await service.readEvaluationResponses(planId, stage, companyId, respondents);

    const template = await readFile(TEMPLATE_PATH);
    const workbook = buildEvaluationSummaryWorkbook(template, summary, responses);

    const fileName = `Evaluation ${summary.course.courseName} ${summary.course.planCode}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);

    // NextResponse, not Response: the guard rolls the session cookie onto whatever comes back, and
    // a plain Response carries none.
    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });
  }, options(dependencies.auth));

export const GET = createExportEvaluationSummaryHandler();
