import { BigInt, NVarChar, type ConnectionPool } from "mssql";
import { getSqlServerPool } from "../database/pool";
import type { AuthenticationAccount } from "./types";

type AuthenticationRow = {
  user_id: string | number;
  username: string;
  password_hash: string;
  account_status: string;
  role_code: string;
  role_status: string;
  employee_id: string | number | null;
  employee_status: string | null;
  employee_company_id: string | number | null;
  employee_company_status: string | null;
  account_company_id: string | number | null;
  account_company_status: string | null;
  account_email: string | null;
  employee_code: string | null;
  employee_first_name_th: string | null;
  employee_last_name_th: string | null;
  employee_first_name_en: string | null;
  employee_last_name_en: string | null;
  employee_email: string | null;
  company_code: string | null;
  company_name_th: string | null;
  company_name_en: string | null;
  function_code: string | null;
  function_name_th: string | null;
  function_name_en: string | null;
  position_code: string | null;
  position_name_th: string | null;
  position_name_en: string | null;
  level_code: string | null;
  level_name_th: string | null;
  level_name_en: string | null;
  pl: string | null;
};

type AuthenticationPool = Pick<ConnectionPool, "request">;
type AuthenticationPoolProvider = () => Promise<AuthenticationPool>;

export type AuthenticationRepository = {
  findByUsername(username: string): Promise<AuthenticationAccount | null>;
  findByUserId(userId: string): Promise<AuthenticationAccount | null>;
};

const AUTHENTICATION_COLUMNS = `
    ua.user_id,
    ua.username,
    ua.password_hash,
    ua.status AS account_status,
    r.role_code,
    r.status AS role_status,
    ua.employee_id,
    e.employment_status AS employee_status,
    e.company_id AS employee_company_id,
    ec.status AS employee_company_status,
    ua.company_id AS account_company_id,
    ac.status AS account_company_status,
    ua.email AS account_email,
    e.employee_code,
    e.first_name_th AS employee_first_name_th,
    e.last_name_th AS employee_last_name_th,
    e.first_name_en AS employee_first_name_en,
    e.last_name_en AS employee_last_name_en,
    e.email AS employee_email,
    COALESCE(ac.company_code, ec.company_code) AS company_code,
    COALESCE(ac.company_name_th, ec.company_name_th) AS company_name_th,
    COALESCE(ac.company_name_en, ec.company_name_en) AS company_name_en,
    f.function_code,
    f.function_name_th,
    f.function_name_en,
    p.position_code,
    p.position_name_th,
    p.position_name_en,
    el.level_code,
    el.level_name_th,
    el.level_name_en,
    el.pl`;

const AUTHENTICATION_JOINS = `
  FROM dbo.user_account AS ua
  INNER JOIN dbo.role AS r ON r.role_id = ua.role_id
  LEFT JOIN dbo.employee AS e ON e.employee_id = ua.employee_id
  LEFT JOIN dbo.company AS ec ON ec.company_id = e.company_id
  LEFT JOIN dbo.company AS ac ON ac.company_id = ua.company_id
  LEFT JOIN dbo.organization_function AS f ON f.function_id = e.function_id
  LEFT JOIN dbo.position AS p ON p.position_id = e.position_id
  LEFT JOIN dbo.employee_level AS el ON el.level_id = e.level_id`;

export const FIND_AUTHENTICATION_ACCOUNT_BY_USERNAME_QUERY = `
  SELECT TOP (1)${AUTHENTICATION_COLUMNS}${AUTHENTICATION_JOINS}
  WHERE ua.username = @username`;

export const FIND_AUTHENTICATION_ACCOUNT_BY_USER_ID_QUERY = `
  SELECT TOP (1)${AUTHENTICATION_COLUMNS}${AUTHENTICATION_JOINS}
  WHERE ua.user_id = @userId`;

const normalizeId = (value: string | number | null) =>
  value === null ? null : String(value);

const mapAuthenticationRow = (
  row: AuthenticationRow | undefined,
): AuthenticationAccount | null =>
  row
    ? {
        userId: String(row.user_id),
        username: row.username,
        passwordHash: row.password_hash,
        accountStatus: row.account_status,
        roleCode: row.role_code,
        roleStatus: row.role_status,
        employeeId: normalizeId(row.employee_id),
        employeeStatus: row.employee_status,
        employeeCompanyId: normalizeId(row.employee_company_id),
        employeeCompanyStatus: row.employee_company_status,
        accountCompanyId: normalizeId(row.account_company_id),
        accountCompanyStatus: row.account_company_status,
        accountEmail: row.account_email,
        employeeCode: row.employee_code,
        employeeFirstNameTh: row.employee_first_name_th,
        employeeLastNameTh: row.employee_last_name_th,
        employeeFirstNameEn: row.employee_first_name_en,
        employeeLastNameEn: row.employee_last_name_en,
        employeeEmail: row.employee_email,
        companyCode: row.company_code,
        companyNameTh: row.company_name_th,
        companyNameEn: row.company_name_en,
        functionCode: row.function_code,
        functionNameTh: row.function_name_th,
        functionNameEn: row.function_name_en,
        positionCode: row.position_code,
        positionNameTh: row.position_name_th,
        positionNameEn: row.position_name_en,
        levelCode: row.level_code,
        levelNameTh: row.level_name_th,
        levelNameEn: row.level_name_en,
        pl: row.pl,
      }
    : null;

export const createAuthenticationRepository = (
  getPool: AuthenticationPoolProvider = getSqlServerPool,
): AuthenticationRepository => ({
  async findByUsername(username) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("username", NVarChar(100), username)
      .query<AuthenticationRow>(FIND_AUTHENTICATION_ACCOUNT_BY_USERNAME_QUERY);

    return mapAuthenticationRow(result.recordset[0]);
  },

  async findByUserId(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", BigInt, userId)
      .query<AuthenticationRow>(FIND_AUTHENTICATION_ACCOUNT_BY_USER_ID_QUERY);

    return mapAuthenticationRow(result.recordset[0]);
  },
});

export const authenticationRepository = createAuthenticationRepository();
