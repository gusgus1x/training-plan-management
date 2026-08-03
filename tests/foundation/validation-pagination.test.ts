import { describe, expect, it } from "vitest";
import {
  readJsonObject,
  readOptionalBoolean,
  readOptionalString,
  readPositiveId,
  readRequiredString,
} from "../../app/lib/api/validation";
import {
  createPaginationMeta,
  readPagination,
} from "../../app/lib/api/pagination";

describe("request validation foundation", () => {
  it("reads only explicitly requested and normalized fields", async () => {
    const body = await readJsonObject(
      new Request("http://localhost/api/example", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          name: "  Company A  ",
          description: "",
          active: true,
          clientSuppliedRoleId: 999,
        }),
      }),
    );

    expect(readRequiredString(body, "name", { maxLength: 100 })).toBe(
      "Company A",
    );
    expect(readOptionalString(body, "description")).toBeNull();
    expect(readOptionalBoolean(body, "active")).toBe(true);
  });

  it("rejects malformed JSON, invalid fields, and invalid identifiers", async () => {
    await expect(
      readJsonObject(
        new Request("http://localhost/api/example", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{broken",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });

    expect(() =>
      readRequiredString({ name: "TOO-LONG" }, "name", { maxLength: 3 }),
    ).toThrow("submitted data is invalid");
    expect(() => readPositiveId("0", "companyId")).toThrow(
      "submitted data is invalid",
    );
    expect(() =>
      readPositiveId("9223372036854775808", "companyId"),
    ).toThrow("submitted data is invalid");
  });
});

describe("pagination foundation", () => {
  it("provides bounded Prisma pagination values and response metadata", () => {
    expect(
      readPagination(new URL("http://localhost/api/companies?page=3&pageSize=25")),
    ).toEqual({ page: 3, pageSize: 25, skip: 50, take: 25 });
    expect(createPaginationMeta(3, 25, 61)).toEqual({
      page: 3,
      pageSize: 25,
      totalItems: 61,
      totalPages: 3,
    });
  });

  it.each([
    "http://localhost/api/companies?page=0",
    "http://localhost/api/companies?page=one",
    "http://localhost/api/companies?pageSize=101",
  ])("rejects invalid pagination in %s", (url) => {
    expect(() => readPagination(new URL(url))).toThrow(
      "Pagination parameters are invalid",
    );
  });
});
