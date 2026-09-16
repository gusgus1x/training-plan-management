import { describe, expect, it, vi } from "vitest";
import { createNeedRequestRepository, stageOf } from "../../app/lib/trainingNeedRequests/repository";
import type { NeedRequestActor } from "../../app/lib/trainingNeedRequests/types";

// A fake Prisma client: nothing here touches a database.

const employeeRow = { employee_code: "0001", title_th: null, title_en: null, first_name_th: "สมชาย", last_name_th: "ทดสอบ", first_name_en: null, last_name_en: null, company: { company_code: "ATA" }, organization_function: null };

const requestRow = (overrides: Record<string, unknown> = {}) => ({
  training_need_request_id: BigInt(7),
  request_no: "TN-202609-000007",
  company_id: BigInt(1),
  function_id: null,
  employee_user_id: "EMP0001",
  requested_course_name: "Excel",
  request_reason: "Need it",
  preferred_start_date: null,
  preferred_end_date: null,
  status: "PENDING",
  requested_at: new Date("2026-09-01T00:00:00Z"),
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  rejection_reason: null,
  approver_user_id: "HEAD0001",
  approver_decision: null,
  approver_decided_at: null,
  approver_note: null,
  approver_opened_at: null,
  training_plan_id: null,
  planned_at: null,
  employee: employeeRow,
  approver: null,
  training_plan: null,
  course_id: null,
  course: null,
  ...overrides,
});

const fakeClient = (row: ReturnType<typeof requestRow>, extra: Record<string, unknown> = {}) => {
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data }));
  const client = {
    training_need_request: {
      findUnique: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue([row]),
      create: vi.fn().mockResolvedValue(row),
      update,
      updateMany: vi.fn(),
    },
    employee: { findUnique: vi.fn() },
    training_plan: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
    ...extra,
  };
  return { client, update };
};

const head: NeedRequestActor = { role: "EMPLOYEE", userId: "9", employeeUserId: "HEAD0001", companyId: "1" };
const center: NeedRequestActor = { role: "HRD_CENTER", userId: "1", employeeUserId: null, companyId: null };
const factory: NeedRequestActor = { role: "HRD_FACTORY", userId: "2", employeeUserId: null, companyId: "1" };

describe("training need request stage", () => {
  it("tells waiting-for-the-head apart from waiting-for-HRD, and whose rejection it was", () => {
    expect(stageOf({ status: "PENDING", approver_user_id: "H", approver_decision: null })).toBe("WAITING_HEAD");
    expect(stageOf({ status: "PENDING", approver_user_id: "H", approver_decision: "APPROVED" })).toBe("WAITING_HRD");
    expect(stageOf({ status: "PENDING", approver_user_id: null, approver_decision: null })).toBe("WAITING_HRD");
    expect(stageOf({ status: "REJECTED", approver_user_id: "H", approver_decision: "REJECTED" })).toBe("REJECTED_BY_HEAD");
    expect(stageOf({ status: "REJECTED", approver_user_id: "H", approver_decision: "APPROVED" })).toBe("REJECTED");
  });
});

describe("the section head step", () => {
  it("lets only the named head decide, and a head's rejection ends the request", async () => {
    const { client, update } = fakeClient(requestRow());
    const repository = createNeedRequestRepository(client as never);

    await expect(
      repository.update("7", { action: "head_approve", note: null, planId: null }, { ...head, employeeUserId: "SOMEONE" }),
    ).rejects.toMatchObject({ status: 403 });

    const result = await repository.update("7", { action: "head_reject", note: "Not now", planId: null }, head);
    expect(update.mock.calls[0][0].data).toMatchObject({ approver_decision: "REJECTED", status: "REJECTED", rejection_reason: "Not now" });
    expect(result.stage).toBe("REJECTED_BY_HEAD");
  });

  it("refuses a second decision once the head has answered", async () => {
    const { client } = fakeClient(requestRow({ approver_decision: "APPROVED", approver_decided_at: new Date() }));
    const repository = createNeedRequestRepository(client as never);
    await expect(repository.update("7", { action: "head_reject", note: "x", planId: null }, head)).rejects.toMatchObject({ status: 409 });
  });

  it("does not let HRD approve a request its head has not approved", async () => {
    const { client } = fakeClient(requestRow());
    const repository = createNeedRequestRepository(client as never);
    await expect(repository.update("7", { action: "approve", note: null, planId: null }, center)).rejects.toMatchObject({ status: 409 });
  });

  it("hides requests still with the head from HRD's list", async () => {
    const { client } = fakeClient(requestRow());
    const repository = createNeedRequestRepository(client as never);
    await repository.list({ status: null, employeeUserId: null, approverUserId: null }, center);
    expect(client.training_need_request.findMany.mock.calls[0][0].where).toMatchObject({
      OR: [{ approver_user_id: null }, { approver_decision: "APPROVED" }],
    });
  });

  it("refuses an approver who is not a section head in the requester's company", async () => {
    const { client } = fakeClient(requestRow());
    client.employee.findUnique
      .mockResolvedValueOnce({ company_id: BigInt(1), function_id: null })
      .mockResolvedValueOnce({ employment_status: "ACTIVE", company_id: BigInt(2), position: { position_code: "SH" }, employee_level: null });
    const repository = createNeedRequestRepository(client as never);
    await expect(
      repository.create({ courseId: null, requestedCourseName: "Excel", requestReason: "r", preferredStartDate: null, preferredEndDate: null, approverUserId: "HEAD0001" }, "EMP0001"),
    ).rejects.toMatchObject({ code: "INVALID_APPROVER" });
  });

  it("records the course the employee picked by id, with its code and name snapshotted beside it", async () => {
    const { client } = fakeClient(requestRow());
    client.employee.findUnique
      .mockResolvedValueOnce({ company_id: BigInt(1), function_id: null })
      .mockResolvedValueOnce({ employment_status: "ACTIVE", company_id: BigInt(1), position: { position_code: "SH", position_name_en: "Section Head" }, employee_level: null });
    client.course.findUnique.mockResolvedValue({ course_id: BigInt(3), course_code: "OT-000002", course_name: "Excel" });
    const repository = createNeedRequestRepository(client as never);

    await repository.create(
      { courseId: "3", requestedCourseName: "[OT-000002] Excel", requestReason: "r", preferredStartDate: null, preferredEndDate: null, approverUserId: "HEAD0001" },
      "EMP0001",
    );

    expect(client.training_need_request.create.mock.calls[0][0].data).toMatchObject({
      course_id: BigInt(3),
      course_code_snapshot: "OT-000002",
      course_name_snapshot: "Excel",
    });
  });

  it("refuses a course id that names no course, rather than filing a request that points nowhere", async () => {
    const { client } = fakeClient(requestRow());
    client.employee.findUnique
      .mockResolvedValueOnce({ company_id: BigInt(1), function_id: null })
      .mockResolvedValueOnce({ employment_status: "ACTIVE", company_id: BigInt(1), position: { position_code: "SH", position_name_en: "Section Head" }, employee_level: null });
    client.course.findUnique.mockResolvedValue(null);
    const repository = createNeedRequestRepository(client as never);

    await expect(
      repository.create(
        { courseId: "999", requestedCourseName: "Excel", requestReason: "r", preferredStartDate: null, preferredEndDate: null, approverUserId: "HEAD0001" },
        "EMP0001",
      ),
    ).rejects.toMatchObject({ code: "COURSE_NOT_FOUND" });
  });
});

describe("who may decide a request, by whose course it names", () => {
  const waitingForHrd = (course: { company_id: bigint | null } | null) =>
    requestRow({ approver_decision: "APPROVED", course });

  it("refuses the centre on a course a factory runs: that factory's HRD answers it", async () => {
    const { client } = fakeClient(waitingForHrd({ company_id: BigInt(2) }));
    const repository = createNeedRequestRepository(client as never);
    await expect(
      repository.update("7", { action: "approve", note: null, planId: null }, center),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a factory HRD on a central course: that one is HRD Center's alone", async () => {
    const { client } = fakeClient(waitingForHrd({ company_id: null }));
    const repository = createNeedRequestRepository(client as never);
    await expect(
      repository.update("7", { action: "approve", note: null, planId: null }, factory),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets the centre decide its own course, and a topic that names no course at all", async () => {
    const centreCourse = fakeClient(waitingForHrd({ company_id: null }));
    const repository = createNeedRequestRepository(centreCourse.client as never);
    await repository.update("7", { action: "approve", note: null, planId: null }, center);
    expect(centreCourse.update.mock.calls[0][0].data).toMatchObject({ status: "APPROVED" });

    const newTopic = fakeClient(waitingForHrd(null));
    await createNeedRequestRepository(newTopic.client as never).update("7", { action: "approve", note: null, planId: null }, center);
    expect(newTopic.update.mock.calls[0][0].data).toMatchObject({ status: "APPROVED" });
  });

  it("refuses the centre planning a factory's course into a batch, not only approving it", async () => {
    const { client } = fakeClient(requestRow({ status: "APPROVED", approver_decision: "APPROVED", course: { company_id: BigInt(2) } }));
    const repository = createNeedRequestRepository(client as never);
    await expect(
      repository.update("7", { action: "link", note: null, planId: "55" }, center),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("linking an approved request to a batch", () => {
  const plan = (companyId: bigint | null) => ({
    plan_id: BigInt(55),
    training_plan_oap: { company_id: companyId, course: { course_id: BigInt(3), course_code: "SY-000003", course_name: "Excel" } },
  });

  it("plans the request into the batch and records the course it became", async () => {
    const { client, update } = fakeClient(requestRow({ status: "APPROVED", approver_decision: "APPROVED" }));
    client.training_plan.findUnique.mockResolvedValue(plan(null));
    const repository = createNeedRequestRepository(client as never);

    await repository.update("7", { action: "link", note: null, planId: "55" }, center);
    expect(update.mock.calls[0][0].data).toMatchObject({ status: "PLANNED", training_plan_id: BigInt(55), course_code_snapshot: "SY-000003" });
  });

  it("refuses another company's batch, and a request that is not approved yet", async () => {
    const approved = fakeClient(requestRow({ status: "APPROVED", approver_decision: "APPROVED" }));
    approved.client.training_plan.findUnique.mockResolvedValue(plan(BigInt(2)));
    await expect(
      createNeedRequestRepository(approved.client as never).update("7", { action: "link", note: null, planId: "55" }, center),
    ).rejects.toMatchObject({ status: 403 });

    const waiting = fakeClient(requestRow({ approver_decision: "APPROVED" }));
    await expect(
      createNeedRequestRepository(waiting.client as never).update("7", { action: "link", note: null, planId: "55" }, center),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("unlinks a planned request back to approved", async () => {
    const { client, update } = fakeClient(requestRow({ status: "PLANNED", training_plan_id: BigInt(55), approver_decision: "APPROVED" }));
    await createNeedRequestRepository(client as never).update("7", { action: "unlink", note: null, planId: null }, center);
    expect(update.mock.calls[0][0].data).toEqual({ status: "APPROVED", training_plan_id: null, planned_at: null });
  });
});
