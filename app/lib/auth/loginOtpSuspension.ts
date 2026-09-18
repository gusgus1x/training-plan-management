import { ApiError } from "../api/errors";
import { getPrismaClient } from "../database/prisma";
import type { AuthenticatedPrincipal } from "./types";

/**
 * Master Data > System: HRD switches the employee email code off per company (migration 46).
 * A switch-off always ends by itself after 24 hours; the check is simply "suspended_until > now",
 * so nothing has to run at the 24-hour mark.
 */
export const OTP_SUSPENSION_HOURS = 24;

export const suspensionEndsAt = (now: Date) =>
  new Date(now.getTime() + OTP_SUSPENSION_HOURS * 60 * 60 * 1000);

/** HRD Center manages every company; HRD Factory only its own. */
export const canManageCompany = (principal: AuthenticatedPrincipal, companyId: string) =>
  principal.role === "HRD_CENTER" ||
  (principal.role === "HRD_FACTORY" && principal.companyId === companyId);

export type CompanyOtpStatus = {
  companyId: string;
  companyCode: string;
  companyName: string;
  /** Set only while the code is switched off. */
  suspendedUntil: Date | null;
  suspendedBy: string | null;
};

export type OtpSuspensionStore = {
  isSuspended(companyId: string, now: Date): Promise<boolean>;
  list(companyIds: string[] | null, now: Date): Promise<CompanyOtpStatus[]>;
  suspend(companyId: string, userId: string, now: Date): Promise<Date>;
  resume(companyId: string): Promise<void>;
  /** Company code for the audit row, so Admin reads "ATA" rather than an id. */
  companyCode(companyId: string): Promise<string | null>;
};

export const prismaOtpSuspensionStore: OtpSuspensionStore = {
  async isSuspended(companyId, now) {
    try {
      const row = await getPrismaClient().login_otp_suspension.findFirst({
        where: { company_id: BigInt(companyId), suspended_until: { gt: now } },
        select: { company_id: true },
      });
      return row !== null;
    } catch (error) {
      // Fails safe: an unreadable switch means the code is still asked for, never skipped.
      console.error("[Login OTP] suspension check failed", error);
      return false;
    }
  },

  async list(companyIds, now) {
    const companies = await getPrismaClient().company.findMany({
      where: {
        status: "ACTIVE",
        ...(companyIds ? { company_id: { in: companyIds.map((id) => BigInt(id)) } } : {}),
      },
      orderBy: { company_code: "asc" },
      select: {
        company_id: true,
        company_code: true,
        company_name_th: true,
        company_name_en: true,
        login_otp_suspension: {
          select: { suspended_until: true, user_account: { select: { username: true } } },
        },
      },
    });
    return companies.map((company) => {
      const suspension = company.login_otp_suspension;
      const active = suspension && suspension.suspended_until.getTime() > now.getTime() ? suspension : null;
      return {
        companyId: company.company_id.toString(),
        companyCode: company.company_code,
        companyName: company.company_name_th || company.company_name_en || company.company_code,
        suspendedUntil: active?.suspended_until ?? null,
        suspendedBy: active?.user_account.username ?? null,
      };
    });
  },

  async suspend(companyId, userId, now) {
    const until = suspensionEndsAt(now);
    const data = { suspended_until: until, suspended_by: BigInt(userId), suspended_at: now };
    await getPrismaClient().login_otp_suspension.upsert({
      where: { company_id: BigInt(companyId) },
      create: { company_id: BigInt(companyId), ...data },
      update: data,
    });
    return until;
  },

  async resume(companyId) {
    await getPrismaClient().login_otp_suspension.deleteMany({ where: { company_id: BigInt(companyId) } });
  },

  async companyCode(companyId) {
    const row = await getPrismaClient().company.findUnique({
      where: { company_id: BigInt(companyId) },
      select: { company_code: true },
    });
    return row?.company_code ?? null;
  },
};

export const forbiddenCompany = () =>
  new ApiError({ code: "FORBIDDEN", message: "You cannot change this company", status: 403 });
