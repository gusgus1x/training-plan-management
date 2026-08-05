import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreateEvaluationHandler,
  createListEvaluationsHandler,
} from "../../app/api/training-course/evaluations/route";
import {
  createDeleteEvaluationHandler,
  createGetEvaluationHandler,
  createUpdateEvaluationHandler,
} from "../../app/api/training-course/evaluations/[evaluationFormId]/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { EvaluationService } from "../../app/lib/evaluations/service";

const center: AuthenticatedPrincipal = {
  userId: "1",
  username: "center.test",
  role: "HRD_CENTER",
  employeeId: null,
  companyId: null,
  email: null,
  employeeCode: null,
  displayName: "Center Test",
  companyCode: null,
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
};

const factory: AuthenticatedPrincipal = {
  ...center,
  userId: "2",
  username: "factory.test",
  role: "HRD_FACTORY",
  companyId: "2",
  companyCode: "TEP",
};

const employee: AuthenticatedPrincipal = {
  ...center,
  userId: "3",
  username: "employee.test",
  role: "EMPLOYEE",
  employeeId: "10",
};

const evaluation = {
  evaluationFormId: "10",
  companyId: "2",
  companyCode: "TEP",
  companyName: "TEP",
  scope: "COMPANY",
  formCode: "EVA-010",
  formName: "Evaluation",
  description: null,
  timing: "AFTER_TRAINING",
  respondentType: "EMPLOYEE",
  isAnonymous: true,
  status: "DRAFT",
  questions: [],
  isUsed: false,
  canModify: true,
  canDuplicate: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: null,
};

const service = () => ({
  listEvaluations: vi.fn().mockResolvedValue({ items: [evaluation], totalItems: 1 }),
  getEvaluation: vi.fn().mockResolvedValue(evaluation),
  createEvaluation: vi.fn().mockResolvedValue(evaluation),
  updateEvaluation: vi.fn().mockResolvedValue(evaluation),
  deleteEvaluation: vi.fn().mockResolvedValue({ evaluation, outcome: "DELETED" }),
}) as unknown as EvaluationService;

const auth = (principal: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: principal.userId,
    issuedAt: 100,
    lastSeenAt: 200,
  }),
  revalidate: vi.fn().mockResolvedValue(principal),
  rollToken: () => "rolled-token",
  production: false,
});

const request = (url: string, init?: RequestInit) =>
  new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: {
      cookie: "tpm_session=valid-token",
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });

describe("evaluation API routes", () => {
  it("allows HRD_FACTORY to list evaluations with filters", async () => {
    const mock = service();
    const handler = createListEvaluationsHandler({ service: mock, auth: auth(factory) });
    const response = await handler(
      request("http://localhost/api/training-course/evaluations?page=2&pageSize=10&status=DRAFT&timing=AFTER_TRAINING&respondentType=EMPLOYEE&search=EVA"),
    );

    expect(response.status).toBe(200);
    expect(mock.listEvaluations).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      search: "EVA",
      status: "DRAFT",
      timing: "AFTER_TRAINING",
      respondentType: "EMPLOYEE",
      skip: 10,
      take: 10,
    }, factory);
  });

  it("creates evaluation with validated payload and AUTO code", async () => {
    const mock = service();
    const handler = createCreateEvaluationHandler({ service: mock, auth: auth(center) });
    const response = await handler(
      request("http://localhost/api/training-course/evaluations", {
        method: "POST",
        body: JSON.stringify({
          scope: "COMPANY",
          companyId: "2",
          formCode: "CLIENT-CODE",
          formName: "Post Training Evaluation",
          description: null,
          timing: "AFTER_TRAINING",
          respondentType: "EMPLOYEE",
          isAnonymous: true,
          status: "DRAFT",
          questions: [{
            questionText: "How satisfied are you?",
            questionType: "RATING",
            sectionName: "Course Content",
            isRequired: true,
            options: [
              { optionText: "1", optionValue: "1" },
              { optionText: "2", optionValue: "2" },
              { optionText: "3", optionValue: "3" },
              { optionText: "4", optionValue: "4" },
              { optionText: "5", optionValue: "5" },
            ],
          }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mock.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      formCode: "AUTO",
      formName: "Post Training Evaluation",
      timing: "AFTER_TRAINING",
      respondentType: "EMPLOYEE",
      isAnonymous: true,
    }), center);
  });

  it("rejects invalid dynamic id before service calls", async () => {
    const mock = service();
    const handler = createGetEvaluationHandler({ service: mock, auth: auth(center) });
    const response = await handler(
      request("http://localhost/api/training-course/evaluations/not-an-id"),
      { params: Promise.resolve({ evaluationFormId: "not-an-id" }) },
    );

    expect(response.status).toBe(400);
    expect(mock.getEvaluation).not.toHaveBeenCalled();
  });

  it("passes validated dynamic id to detail, update, and delete handlers", async () => {
    const mock = service();
    const context = { params: Promise.resolve({ evaluationFormId: "10" }) };
    const getHandler = createGetEvaluationHandler({ service: mock, auth: auth(center) });
    const patchHandler = createUpdateEvaluationHandler({ service: mock, auth: auth(center) });
    const deleteHandler = createDeleteEvaluationHandler({ service: mock, auth: auth(center) });

    expect((await getHandler(request("http://localhost/api/training-course/evaluations/10"), context)).status).toBe(200);
    expect((await patchHandler(request("http://localhost/api/training-course/evaluations/10", {
      method: "PATCH",
      body: JSON.stringify({
        scope: "COMPANY",
        companyId: "2",
        formCode: "EVA-010",
        formName: "Evaluation Updated",
        description: null,
        timing: "AFTER_TRAINING",
        respondentType: "EMPLOYEE",
        isAnonymous: true,
        status: "DRAFT",
        questions: [{
          questionText: "How satisfied are you?",
          questionType: "RATING",
          sectionName: "Course Content",
          isRequired: true,
          options: [
            { optionText: "1", optionValue: "1" },
            { optionText: "2", optionValue: "2" },
            { optionText: "3", optionValue: "3" },
            { optionText: "4", optionValue: "4" },
            { optionText: "5", optionValue: "5" },
          ],
        }],
      }),
    }), context)).status).toBe(200);
    expect((await deleteHandler(request("http://localhost/api/training-course/evaluations/10", { method: "DELETE" }), context)).status).toBe(200);

    expect(mock.getEvaluation).toHaveBeenCalledWith("10", center);
    expect(mock.updateEvaluation).toHaveBeenCalledWith("10", expect.objectContaining({ formName: "Evaluation Updated" }), center);
    expect(mock.deleteEvaluation).toHaveBeenCalledWith("10", center);
  });

  it("denies non-HRD roles before calling service", async () => {
    const mock = service();
    const handler = createListEvaluationsHandler({ service: mock, auth: auth(employee) });
    const response = await handler(request("http://localhost/api/training-course/evaluations"));

    expect(response.status).toBe(403);
    expect(mock.listEvaluations).not.toHaveBeenCalled();
  });
});
