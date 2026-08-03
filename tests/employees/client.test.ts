import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listEmployees,
  revealEmployeeNationalId,
} from "../../app/lib/employees/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("employee client", () => {
  it("requests a page size accepted by the shared API pagination", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { items: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);

    await listEmployees();

    expect(fetcher).toHaveBeenCalledWith(
      "/api/master-data/employees?page=1&pageSize=100",
      { credentials: "include", cache: "no-store" },
    );
  });

  it("uses the dedicated top-level route to reveal a National ID", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { nationalId: "1234567890123" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);

    await revealEmployeeNationalId("2");

    expect(fetcher).toHaveBeenCalledWith(
      "/api/master-data/employee-national-ids/2",
      { credentials: "include", cache: "no-store" },
    );
  });
});
