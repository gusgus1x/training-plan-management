import { afterEach, describe, expect, it, vi } from "vitest";
import { createCertificateService } from "../../app/lib/certificates/service";
import type { CertificateRepository } from "../../app/lib/certificates/repository";

const storage = vi.hoisted(() => ({
  written: [] as string[],
  deleted: [] as string[],
}));

vi.mock("../../app/lib/certificates/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/lib/certificates/storage")>();
  return {
    ...actual,
    writeCertificateFile: vi.fn(async (relativePath: string) => {
      storage.written.push(relativePath);
    }),
    deleteCertificateFile: vi.fn(async (relativePath: string) => {
      storage.deleted.push(relativePath);
    }),
  };
});

const pdf = (marker = "a") => new TextEncoder().encode(`%PDF-1.7\n${marker}`);

const repositoryStub = (overrides: Partial<CertificateRepository> = {}) =>
  ({
    appendToDraft: vi.fn(async () => ({
      batchId: "1",
      importBatchCode: "CERT-42-1",
      importedAt: "2026-09-07T00:00:00.000Z",
      cards: [],
    })),
    loadPlanView: vi.fn(async () => ({ roster: [], draft: null })),
    confirmDraft: vi.fn(async () => ({ removedPaths: [] })),
    discardDraft: vi.fn(async () => ({ removedPaths: [] })),
    loadFileForPrincipal: vi.fn(),
    ...overrides,
  }) as unknown as CertificateRepository;

afterEach(() => {
  storage.written.length = 0;
  storage.deleted.length = 0;
  vi.clearAllMocks();
});

describe("uploadCertificates", () => {
  it("rejects a misnamed file before it is ever written to disk", async () => {
    const repository = repositoryStub();
    const service = createCertificateService(repository);

    const result = await service.uploadCertificates(
      "42",
      [{ fileName: "สมชาย.pdf", bytes: pdf() }],
      "99",
      null,
    );

    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("SAP UserID");
    expect(storage.written).toHaveLength(0);
    expect(repository.appendToDraft).toHaveBeenCalledWith("42", [], "99", null);
  });

  it("rejects a file that is not really a PDF, and keeps the good one", async () => {
    const service = createCertificateService(repositoryStub());

    const result = await service.uploadCertificates(
      "42",
      [
        { fileName: "12345_ok.pdf", bytes: pdf("good") },
        { fileName: "12346_fake.pdf", bytes: new TextEncoder().encode("just text") },
      ],
      "99",
      null,
    );

    expect(result.rejected.map((entry) => entry.fileName)).toEqual(["12346_fake.pdf"]);
    expect(storage.written).toHaveLength(1);
  });

  it("pairs each stored file with its own bytes when an earlier file was rejected", async () => {
    // Indexing the byte arrays by position would file the second employee's PDF under the first
    // one's row the moment anything ahead of it is skipped.
    const writeSpy = vi.mocked(
      (await import("../../app/lib/certificates/storage")).writeCertificateFile,
    );
    const service = createCertificateService(repositoryStub());

    await service.uploadCertificates(
      "42",
      [
        { fileName: "bad-name.pdf", bytes: pdf("skipped") },
        { fileName: "12345_second.pdf", bytes: pdf("second") },
      ],
      "99",
      null,
    );

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(new TextDecoder().decode(writeSpy.mock.calls[0]?.[1] as Uint8Array)).toContain("second");
  });

  it("removes everything it wrote when the database write fails", async () => {
    // Otherwise a permissions error leaves PDFs on disk that no row points at.
    const repository = repositoryStub({
      appendToDraft: vi.fn(async () => {
        throw new Error("no INSERT permission");
      }) as unknown as CertificateRepository["appendToDraft"],
    });
    const service = createCertificateService(repository);

    await expect(
      service.uploadCertificates(
        "42",
        [
          { fileName: "12345_a.pdf", bytes: pdf("a") },
          { fileName: "12346_b.pdf", bytes: pdf("b") },
        ],
        "99",
        null,
      ),
    ).rejects.toThrow(/INSERT/);

    expect(storage.deleted).toEqual(storage.written);
    expect(storage.deleted).toHaveLength(2);
  });
});

describe("confirmCertificates", () => {
  it("unlinks dropped files only after the transaction has committed", async () => {
    const repository = repositoryStub({
      confirmDraft: vi.fn(async () => ({ removedPaths: ["42/cert_9.pdf"] })) as unknown as CertificateRepository["confirmDraft"],
    });
    const service = createCertificateService(repository);

    await service.confirmCertificates("42", { assignments: [] }, "99", null);

    expect(repository.confirmDraft).toHaveBeenCalled();
    expect(storage.deleted).toEqual(["42/cert_9.pdf"]);
  });
});
