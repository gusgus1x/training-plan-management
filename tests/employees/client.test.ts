import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listEmployees,
  revealEmployeeNationalId,
  updateEmployee,
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

  it("shows the National ID validation reason returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "INVALID_INPUT",
              message: "The submitted employee data is invalid",
              details: {
                field: "nationalId",
                reason: "National ID must contain exactly 13 digits",
              },
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(updateEmployee("2", { nationalId: "invalid" })).rejects.toThrow(
      "The submitted employee data is invalid: National ID must contain exactly 13 digits",
    );
  });
});
