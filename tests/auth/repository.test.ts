import type { ConnectionPool } from "mssql";
import { describe, expect, it, vi } from "vitest";
import {
  createAuthenticationRepository,
  FIND_AUTHENTICATION_ACCOUNT_BY_USERNAME_QUERY,
  FIND_AUTHENTICATION_ACCOUNT_BY_USER_ID_QUERY,
} from "../../app/lib/auth/repository";

const row = {
  user_id: "9007199254740993",
  username: "employee.test",
  password_hash: "test-hash",
  account_status: "ACTIVE",
  role_code: "EMPLOYEE",
  role_status: "ACTIVE",
  employee_id: "101",
  employee_status: "ACTIVE",
  employee_company_id: "10",
  employee_company_status: "ACTIVE",
  account_company_id: null,
  account_company_status: null,
  account_email: "employee.test@example.invalid",
  employee_code: "DEV-EMP-001",
  employee_first_name_th: "พนักงาน",
  employee_last_name_th: "ทดสอบ",
  employee_first_name_en: "Employee",
  employee_last_name_en: "Test",
  employee_email: "employee.test@example.invalid",
  company_code: "ATA",
  company_name_th: "บริษัททดสอบ ATA",
  company_name_en: "ATA Test Company",
  function_code: "DEV_PRODUCTION",
  function_name_th: "ฝ่ายผลิต",
  function_name_en: "Production",
  position_code: "DEV_OPERATOR",
  position_name_th: "พนักงานฝ่ายผลิต",
  position_name_en: "Operator",
  level_code: "DEV_OPERATOR",
  level_name_th: "ระดับปฏิบัติการ",
  level_name_en: "Operator Level",
  pl: "DEV-PL1",
};

const createPool = () => {
  const query = vi.fn().mockResolvedValue({ recordset: [row] });
  const request = {
    input: vi.fn(),
    query,
  };
  request.input.mockReturnValue(request);

  return {
    pool: { request: () => request } as unknown as Pick<ConnectionPool, "request">,
    request,
    query,
  };
};

describe("authentication repository", () => {
  it("uses a parameter for username and maps explicit authentication columns", async () => {
    const { pool, request, query } = createPool();
    const repository = createAuthenticationRepository(async () => pool);

    const account = await repository.findByUsername("employee.test");

    expect(request.input).toHaveBeenCalledTimes(1);
    expect(request.input.mock.calls[0]?.[0]).toBe("username");
    expect(request.input.mock.calls[0]?.[2]).toBe("employee.test");
    expect(query).toHaveBeenCalledWith(
      FIND_AUTHENTICATION_ACCOUNT_BY_USERNAME_QUERY,
    );
    expect(account).toMatchObject({
      userId: "9007199254740993",
      roleCode: "EMPLOYEE",
      employeeCompanyId: "10",
    });
  });

  it("uses a parameter for user id during protected-request revalidation", async () => {
    const { pool, request, query } = createPool();
    const repository = createAuthenticationRepository(async () => pool);

    await repository.findByUserId("9007199254740993");

    expect(request.input.mock.calls[0]?.[0]).toBe("userId");
    expect(request.input.mock.calls[0]?.[2]).toBe("9007199254740993");
    expect(query).toHaveBeenCalledWith(
      FIND_AUTHENTICATION_ACCOUNT_BY_USER_ID_QUERY,
    );
  });

  it("contains no wildcard select or database write statement", () => {
    const queries = [
      FIND_AUTHENTICATION_ACCOUNT_BY_USERNAME_QUERY,
      FIND_AUTHENTICATION_ACCOUNT_BY_USER_ID_QUERY,
    ].join("\n");

    expect(queries).not.toMatch(/SELECT\s+\*/i);
    expect(queries).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  });
});
