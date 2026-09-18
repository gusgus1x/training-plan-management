import { getPrismaClient } from "../database/prisma";
import { hashPassword } from "./password";
import { authenticationRepository, type AuthenticationRepository } from "./repository";
import type { AuthenticationAccount } from "./types";

/**
 * Converts a birth date into DDMMYYYY format (e.g. 1972-05-11 -> "11051972").
 * Uses UTC date values to prevent any timezone shifts.
 */
export const formatBirthDateToDDMMYYYY = (birthDate: Date | string | null): string => {
  if (!birthDate) return "";
  let dateStr = "";
  if (birthDate instanceof Date) {
    dateStr = birthDate.toISOString().slice(0, 10);
  } else {
    dateStr = String(birthDate).slice(0, 10);
  }
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return "";
  return `${day.padStart(2, "0")}${month.padStart(2, "0")}${year}`;
};

/**
 * Automatically provisions an employee user_account on their first login attempt
 * if their username matches an active employee record and the password matches
 * their birth date formatted as DDMMYYYY.
 */
export const autoProvisionEmployeeAccount = async (
  username: string,
  password: string,
  repository: AuthenticationRepository = authenticationRepository,
): Promise<AuthenticationAccount | null> => {
  const normalizedUsername = username.trim();
  // Employee birth dates are strictly 8 digits (DDMMYYYY)
  if (!/^\d{8}$/.test(password)) {
    return null;
  }

  try {
    const prisma = getPrismaClient();

    // Find active employee matching username by employee_code or user_id
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employee_code: normalizedUsername },
          { user_id: normalizedUsername },
        ],
        employment_status: "ACTIVE",
      },
      select: {
        employee_id: true,
        company_id: true,
        employee_code: true,
        user_id: true,
        birth_date: true,
      },
    });

    if (!employee || !employee.birth_date) {
      return null;
    }

    const expectedPassword = formatBirthDateToDDMMYYYY(employee.birth_date);
    if (!expectedPassword || password !== expectedPassword) {
      return null;
    }

    // Resolve EMPLOYEE role
    const employeeRole = await prisma.role.findFirst({
      where: {
        role_code: "EMPLOYEE",
        status: "ACTIVE",
      },
      select: { role_id: true },
    });

    if (!employeeRole) {
      return null;
    }

    const passwordHash = await hashPassword(password);

    // Create the user_account (handle duplicate key gracefully in case of concurrent requests)
    try {
      await prisma.user_account.create({
        data: {
          username: normalizedUsername,
          password_hash: passwordHash,
          role_id: employeeRole.role_id,
          company_id: employee.company_id,
          employee_user_id: employee.user_id,
          status: "ACTIVE",
          created_at: new Date(),
        },
      });
    } catch (createError) {
      // If already created concurrently, proceed to fetch
      console.warn("[Auto-Provision] Concurrent account notice:", createError);
    }

    // Fetch the newly provisioned account
    return await repository.findByUsername(normalizedUsername);
  } catch (error) {
    console.error("[Auto-Provision Error]", error);
    return null;
  }
};
