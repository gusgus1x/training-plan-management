import { describe, expect, it, vi } from "vitest";
import { createCertificateRepository } from "../../app/lib/certificates/repository";

/**
 * The confirm path, against a hand-built db. Only the models the code path touches are stubbed, in
 * the style of tests/trainingForms/plan-form-override.test.ts.
 */

type Attendee = { enrollmentId: string; userId: string; hasResult?: boolean };

type IssuedRow = { id: string; userId: string; verifiedAt?: Date | null };

const buildDb = (
  attendees: Attendee[],
  draftFiles: Array<{ id: string; userId: string | null; mappingStatus?: string }>,
  options: { hasDraft?: boolean; issued?: IssuedRow[] } = {},
) => {
  const calls: string[] = [];

  const plan = {
    plan_id: BigInt(42),
    training_plan_oap: { company_id: BigInt(7) },
    training_enrollment: attendees.map((attendee) => ({
      enrollment_id: BigInt(attendee.enrollmentId),
      employee_user_id: attendee.userId,
      training_result: attendee.hasResult ? { result_id: BigInt(`9${attendee.enrollmentId}`) } : null,
      employee: { employee_code: `C-${attendee.userId}`, first_name_th: "ชื่อ", last_name_th: attendee.userId },
    })),
  };

  const batch = {
    certificate_import_batch_id: BigInt(300),
    import_batch_code: "CERT-42-1",
    imported_at: new Date("2026-09-07T00:00:00.000Z"),
    training_certificate_file: draftFiles.map((file) => ({
      certificate_file_id: BigInt(file.id),
      original_file_name_masked: `${file.userId ?? "x"}_name.pdf`,
      employee_user_id: file.userId,
      mapping_status: file.mappingStatus ?? "MATCHED",
      storage_path: `42/cert_${file.id}.pdf`,
    })),
  };

  type Args = { data?: Record<string, unknown>; where?: Record<string, unknown> };

  const updateMany = vi.fn(async (_args: Args) => {
    calls.push("supersede");
    return { count: 1 };
  });
  const update = vi.fn(async (_args: Args) => {
    calls.push("activate");
    return {};
  });
  const deleteMany = vi.fn(async (_args: Args) => {
    calls.push("delete");
    return { count: 1 };
  });
  const deleteOne = vi.fn(async (_args: Args) => {
    calls.push("delete-one");
    return {};
  });
  const batchDelete = vi.fn(async (_args: Args) => {
    calls.push("batch-delete");
    return {};
  });
  const batchUpdate = vi.fn(async (_args: Args) => {
    calls.push("batch-update");
    return {};
  });

  const models = {
    training_plan: { findUnique: async () => plan },
    certificate_import_batch: {
      findFirst: async () => (options.hasDraft === false ? null : batch),
      update: batchUpdate,
      create: async () => ({ certificate_import_batch_id: BigInt(300) }),
      delete: batchDelete,
    },
    training_certificate_file: {
      // The repository always filters to CONFIRMED + ACTIVE, so this stands in for rows that
      // already passed that filter.
      findMany: async () =>
        (options.issued ?? []).map((row) => ({
          certificate_file_id: BigInt(row.id),
          original_file_name_masked: `${row.userId}_issued.pdf`,
          employee_user_id: row.userId,
          verified_at: row.verifiedAt === undefined ? new Date("2026-09-01T00:00:00.000Z") : row.verifiedAt,
          created_at: new Date("2026-08-01T00:00:00.000Z"),
        })),
      updateMany,
      update,
      deleteMany,
      delete: deleteOne,
      create: async () => ({}),
    },
  };

  const db = {
    ...models,
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(models),
  };

  return { db, calls, updateMany, update, deleteMany, deleteOne, batchDelete, batchUpdate };
};

const repositoryFor = (db: unknown) =>
  createCertificateRepository(db as Parameters<typeof createCertificateRepository>[0]);

describe("confirmDraft", () => {
  it("supersedes the previous certificate before activating the replacement", async () => {
    // Both filtered unique indexes reject the write if the predecessor is still ACTIVE, so the
    // order here is load-bearing, not stylistic.
    const { db, calls } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await repositoryFor(db).confirmDraft(
      "42",
      { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
      "99",
      null,
    );
    expect(calls.indexOf("supersede")).toBeLessThan(calls.indexOf("activate"));
  });

  it("clears training_result_id on the superseded row", async () => {
    // schema.prisma models training_result_id as unique, so leaving it on a superseded row makes
    // training_result.training_certificate_file ambiguous.
    const { db, updateMany } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await repositoryFor(db).confirmDraft(
      "42",
      { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
      "99",
      null,
    );
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { training_result_id: null } });
  });

  it("links the training result when the attendee already has one", async () => {
    const { db, update } = buildDb(
      [{ enrollmentId: "1", userId: "u-1", hasResult: true }],
      [{ id: "10", userId: "u-1" }],
    );
    await repositoryFor(db).confirmDraft(
      "42",
      { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
      "99",
      null,
    );
    expect(update.mock.calls[0]?.[0]).toMatchObject({ data: { training_result_id: BigInt(91) } });
  });

  it("leaves training_result_id null when results have not been saved yet", async () => {
    const { db, update } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await repositoryFor(db).confirmDraft(
      "42",
      { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
      "99",
      null,
    );
    expect(update.mock.calls[0]?.[0]).toMatchObject({ data: { training_result_id: null } });
  });

  it("refuses an employee who is not on this plan", async () => {
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await expect(
      repositoryFor(db).confirmDraft(
        "42",
        { assignments: [{ certificateFileId: "10", employeeUserId: "stranger" }] },
        "99",
        null,
      ),
    ).rejects.toMatchObject({ code: "EMPLOYEE_NOT_ON_PLAN", status: 409 });
  });

  it("refuses two certificates assigned to one employee", async () => {
    const { db } = buildDb(
      [{ enrollmentId: "1", userId: "u-1" }],
      [
        { id: "10", userId: "u-1" },
        { id: "11", userId: "u-1" },
      ],
    );
    await expect(
      repositoryFor(db).confirmDraft(
        "42",
        {
          assignments: [
            { certificateFileId: "10", employeeUserId: "u-1" },
            { certificateFileId: "11", employeeUserId: "u-1" },
          ],
        },
        "99",
        null,
      ),
    ).rejects.toMatchObject({ code: "CERTIFICATE_DUPLICATE_EMPLOYEE", status: 409 });
  });

  it("refuses a certificate file that belongs to another batch", async () => {
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await expect(
      repositoryFor(db).confirmDraft(
        "42",
        { assignments: [{ certificateFileId: "77", employeeUserId: "u-1" }] },
        "99",
        null,
      ),
    ).rejects.toMatchObject({ code: "CERTIFICATE_NOT_IN_BATCH", status: 409 });
  });

  it("deletes the cards HRD dropped and hands back their paths for unlinking", async () => {
    const { db, deleteMany } = buildDb(
      [
        { enrollmentId: "1", userId: "u-1" },
        { enrollmentId: "2", userId: "u-2" },
      ],
      [
        { id: "10", userId: "u-1" },
        { id: "11", userId: "u-2" },
      ],
    );
    const result = await repositoryFor(db).confirmDraft(
      "42",
      { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
      "99",
      null,
    );
    expect(result.removedPaths).toEqual(["42/cert_11.pdf"]);
    expect(deleteMany).toHaveBeenCalled();
  });

  it("marks the batch confirmed with the counts it actually issued", async () => {
    const { db, batchUpdate } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await repositoryFor(db).confirmDraft(
      "42",
      { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
      "99",
      null,
    );
    expect(batchUpdate.mock.calls[0]?.[0]).toMatchObject({
      data: { import_status: "CONFIRMED", total_file_count: 1, matched_file_count: 1, failed_file_count: 0 },
    });
  });

  it("refuses to confirm when there is no draft", async () => {
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [], { hasDraft: false });
    await expect(
      repositoryFor(db).confirmDraft("42", { assignments: [] }, "99", null),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reports who already holds a certificate, so HRD can see it without re-uploading", async () => {
    const { db } = buildDb(
      [
        { enrollmentId: "1", userId: "u-1" },
        { enrollmentId: "2", userId: "u-2" },
      ],
      [],
      { hasDraft: false, issued: [{ id: "50", userId: "u-1" }] },
    );

    const view = await repositoryFor(db).loadPlanView("42", null);

    expect(view.issued).toEqual([
      {
        certificateFileId: "50",
        fileName: "u-1_issued.pdf",
        employeeUserId: "u-1",
        employeeCode: "C-u-1",
        employeeName: "ชื่อ u-1",
        issuedAt: "2026-09-01T00:00:00.000Z",
      },
    ]);
    // u-2 is absent from the list, which is what makes "still waiting" derivable in the UI.
    expect(view.roster).toHaveLength(2);
  });

  it("falls back to created_at when a row has no verified_at", async () => {
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [], {
      hasDraft: false,
      issued: [{ id: "50", userId: "u-1", verifiedAt: null }],
    });

    const view = await repositoryFor(db).loadPlanView("42", null);
    expect(view.issued[0]?.issuedAt).toBe("2026-08-01T00:00:00.000Z");
  });

  it("drops an issued row whose employee is no longer on the batch", async () => {
    // Otherwise the list would name somebody the roster cannot explain.
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [], {
      hasDraft: false,
      issued: [{ id: "50", userId: "someone-removed" }],
    });

    const view = await repositoryFor(db).loadPlanView("42", null);
    expect(view.issued).toEqual([]);
  });

  it("marks a card REPLACE when that employee already holds a certificate", async () => {
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }], {
      issued: [{ id: "50", userId: "u-1" }],
    });

    const view = await repositoryFor(db).loadPlanView("42", null);
    expect(view.draft?.cards[0]?.state).toBe("REPLACE");
  });

  it("refuses a factory user working on another company's plan", async () => {
    const { db } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);
    await expect(
      repositoryFor(db).confirmDraft(
        "42",
        { assignments: [{ certificateFileId: "10", employeeUserId: "u-1" }] },
        "99",
        "8",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("removeDraftFile", () => {
  it("deletes the row so the next upload cannot bring the file back", async () => {
    // The bug this covers: the card was dropped on screen only. The next upload answers with the
    // whole draft as the database still holds it, so the removed file reappeared and only
    // discarding the entire batch could clear it.
    const { db, deleteOne } = buildDb(
      [{ enrollmentId: "1", userId: "u-1" }],
      [
        { id: "10", userId: "u-1" },
        { id: "11", userId: null },
      ],
    );

    const result = await repositoryFor(db).removeDraftFile("42", "10", null);

    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(result.removedPaths).toEqual(["42/cert_10.pdf"]);
  });

  it("drops the batch along with its last file", async () => {
    const { db, batchDelete } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);

    await repositoryFor(db).removeDraftFile("42", "10", null);

    expect(batchDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps the batch while other files remain", async () => {
    const { db, batchDelete } = buildDb(
      [{ enrollmentId: "1", userId: "u-1" }],
      [
        { id: "10", userId: "u-1" },
        { id: "11", userId: null },
      ],
    );

    await repositoryFor(db).removeDraftFile("42", "10", null);

    expect(batchDelete).not.toHaveBeenCalled();
  });

  it("refuses a file id that is not in this plan's draft", async () => {
    // Otherwise a file id from another plan would delete a row this HRD user cannot even see.
    const { db, deleteOne } = buildDb([{ enrollmentId: "1", userId: "u-1" }], [{ id: "10", userId: "u-1" }]);

    await expect(repositoryFor(db).removeDraftFile("42", "999", null)).rejects.toMatchObject({ status: 404 });
    expect(deleteOne).not.toHaveBeenCalled();
  });
});
