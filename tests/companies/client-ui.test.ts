import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "../../app/lib/companies/client";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: status < 400, data }), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("company client and UI integration", () => {
  it("uses protected company endpoints for list, create, and update", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [],
          pagination: {
            page: 1,
            pageSize: 100,
            totalItems: 0,
            totalPages: 0,
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ company: { companyId: "7" } }, 201))
      .mockResolvedValueOnce(jsonResponse({ company: { companyId: "7" } }))
      .mockResolvedValueOnce(jsonResponse({ company: { companyId: "7" } }));

    await listCompanies(fetcher);
    await createCompany(
      {
        companyCode: "NEW",
        companyNameTh: "บริษัทใหม่",
        companyNameEn: null,
        remark: null,
        status: "ACTIVE",
      },
      fetcher,
    );
    await updateCompany("7", { status: "INACTIVE" }, fetcher);
    await deleteCompany("7", fetcher);

    expect(fetcher.mock.calls[0]?.[0]).toContain(
      "/api/master-data/companies?page=1&pageSize=100",
    );
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
    expect(fetcher.mock.calls[2]?.[0]).toBe(
      "/api/master-data/companies/7",
    );
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({ method: "PATCH" });
    expect(fetcher.mock.calls[3]?.[0]).toBe(
      "/api/master-data/companies/7",
    );
    expect(fetcher.mock.calls[3]?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("removes the six hard-coded company rows from the active component", () => {
    const source = readFileSync(
      new URL(
        "../../app/components/center_factory/MasterDataManagement/modules/CompanyData.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("listCompanies");
    expect(source).toContain("createCompany");
    expect(source).toContain("updateCompany");
    expect(source).toContain("deleteCompany");
    expect(source).toContain(
      "selectedRecord?.companyId === authenticatedUser.companyId",
    );
    expect(source).toContain("disabled={!canModifySelected || isSaving}");
    expect(source).not.toContain("defaultRows");
    expect(source).not.toContain("companyNameByCode");
    expect(source).toContain("handleDelete");
  });
});
