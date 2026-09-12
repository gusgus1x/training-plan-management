import type { NextRequest } from "next/server";
import { apiFailure, apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute } from "../../../../lib/auth/guard";
import { getPrismaClient } from "../../../../lib/database/prisma";
import {
  parseInstructorCsvText,
  parseInstructorXlsxBuffer,
  type InstructorImportRow,
} from "../../../../lib/instructors/instructorImport";

const CODE_PATTERN = /^([A-Za-z]+)(\d+)$/;

function getNextAutoCodes(
  existingCodes: string[],
  needed: number,
  fallbackPrefix: string = "INS",
): string[] {
  let activePrefix = fallbackPrefix;
  let maxNumber = 0;
  let width = 4;

  const prefixCounts = new Map<string, number>();
  for (const code of existingCodes) {
    const match = code.trim().match(CODE_PATTERN);
    if (match) {
      prefixCounts.set(match[1], (prefixCounts.get(match[1]) ?? 0) + 1);
    }
  }
  let topCount = 0;
  for (const [prefix, count] of prefixCounts) {
    if (count > topCount) {
      topCount = count;
      activePrefix = prefix;
    }
  }

  for (const code of existingCodes) {
    const match = code.trim().match(CODE_PATTERN);
    if (!match || match[1].toUpperCase() !== activePrefix.toUpperCase()) continue;
    const value = parseInt(match[2], 10);
    if (value > maxNumber) {
      maxNumber = value;
      width = match[2].length;
    }
  }

  const generated: string[] = [];
  for (let i = 1; i <= needed; i++) {
    generated.push(`${activePrefix}${String(maxNumber + i).padStart(width, "0")}`);
  }
  return generated;
}

export const POST = createProtectedRoute(
  async (request: NextRequest) => {
    try {
      const contentType = request.headers.get("content-type") || "";

      // ── Action 1: Upload and Parse File (multipart/form-data) ──
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
          return apiFailure({
            code: "NO_FILE",
            message: "No file uploaded",
            status: 400,
          });
        }

        const fileName = file.name;
        const lowerName = fileName.toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());

        let rawRows: InstructorImportRow[] = [];
        if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
          rawRows = parseInstructorXlsxBuffer(buffer);
        } else if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
          rawRows = parseInstructorCsvText(buffer.toString("utf8"));
        } else {
          return apiFailure({
            code: "UNSUPPORTED_FORMAT",
            message: "Unsupported file format. Please upload .xlsx, .xls, or .csv",
            status: 400,
          });
        }

        if (rawRows.length === 0) {
          return apiSuccess({
            success: true,
            fileName,
            rowCount: 0,
            rows: [],
            summary: {
              total: 0,
              valid: 0,
              invalid: 0,
              newCount: 0,
              updateCount: 0,
            },
          });
        }

        // Fetch existing instructors from DB to check new vs update
        const prisma = getPrismaClient();
        const existingInstructors = await prisma.instructor.findMany({
          select: {
            instructor_id: true,
            instructor_code: true,
            first_name: true,
            last_name: true,
          },
        });

        const codeToRecordMap = new Map<string, { id: string; code: string }>();
        const nameToRecordMap = new Map<string, { id: string; code: string }>();
        const allExistingCodes: string[] = [];

        existingInstructors.forEach((rec) => {
          const code = rec.instructor_code.trim();
          allExistingCodes.push(code);
          codeToRecordMap.set(code.toUpperCase(), { id: rec.instructor_id.toString(), code });
          const fullName = `${rec.first_name.trim()} ${rec.last_name.trim()}`.toLowerCase();
          nameToRecordMap.set(fullName, { id: rec.instructor_id.toString(), code });
        });

        // Determine how many new codes we will need
        let neededCodesCount = 0;
        rawRows.forEach((row) => {
          if (!row.isValid) return;
          const normCode = row.instructorCode ? row.instructorCode.toUpperCase() : "";
          const fullName = `${row.firstName.trim()} ${row.lastName.trim()}`.toLowerCase();
          const matchByCode = normCode ? codeToRecordMap.get(normCode) : null;
          const matchByName = !normCode ? nameToRecordMap.get(fullName) : null;
          if (!matchByCode && !matchByName && !normCode) {
            neededCodesCount++;
          }
        });

        const autoCodes = getNextAutoCodes(allExistingCodes, neededCodesCount);
        let autoCodeIndex = 0;

        let validCount = 0;
        let invalidCount = 0;
        let newCount = 0;
        let updateCount = 0;

        const enrichedRows: InstructorImportRow[] = rawRows.map((row) => {
          if (!row.isValid) {
            invalidCount++;
            return {
              ...row,
              dbStatus: "ERROR" as const,
            };
          }

          validCount++;
          const normCode = row.instructorCode ? row.instructorCode.toUpperCase() : "";
          const fullName = `${row.firstName.trim()} ${row.lastName.trim()}`.toLowerCase();

          const matchByCode = normCode ? codeToRecordMap.get(normCode) : null;
          const matchByName = !normCode ? nameToRecordMap.get(fullName) : null;
          const matched = matchByCode || matchByName;

          if (matched) {
            updateCount++;
            return {
              ...row,
              instructorCode: row.instructorCode || matched.code,
              dbStatus: "UPDATE" as const,
              existingInstructorId: matched.id,
            };
          } else {
            newCount++;
            const generatedCode = normCode || autoCodes[autoCodeIndex++] || "INS0001";
            return {
              ...row,
              instructorCode: generatedCode,
              dbStatus: "NEW" as const,
            };
          }
        });

        return apiSuccess({
          success: true,
          fileName,
          rowCount: enrichedRows.length,
          rows: enrichedRows,
          summary: {
            total: enrichedRows.length,
            valid: validCount,
            invalid: invalidCount,
            newCount,
            updateCount,
          },
        });
      }

      // ── Action 2: Commit Batch Import (application/json) ──
      const body = await request.json();
      const { rows, overwriteExisting = true } = body as {
        rows?: InstructorImportRow[];
        overwriteExisting?: boolean;
      };

      if (!Array.isArray(rows) || rows.length === 0) {
        return apiFailure({
          code: "INVALID_ROWS",
          message: "No rows provided for import",
          status: 400,
        });
      }

      const validRows = rows.filter((r) => r.isValid && r.firstName && r.lastName);
      if (validRows.length === 0) {
        return apiFailure({
          code: "NO_VALID_ROWS",
          message: "None of the rows are valid for import",
          status: 400,
        });
      }

      const prisma = getPrismaClient();

      // Retrieve current database state for code generation and matching
      const allCurrentInstructors = await prisma.instructor.findMany({
        select: {
          instructor_id: true,
          instructor_code: true,
          first_name: true,
          last_name: true,
        },
      });

      const dbCodes = new Set<string>();
      const existingCodesList: string[] = [];
      const dbNameToIdMap = new Map<string, { id: bigint; code: string }>();

      allCurrentInstructors.forEach((ins) => {
        const c = ins.instructor_code.trim().toUpperCase();
        dbCodes.add(c);
        existingCodesList.push(ins.instructor_code.trim());
        const name = `${ins.first_name.trim()} ${ins.last_name.trim()}`.toLowerCase();
        dbNameToIdMap.set(name, { id: ins.instructor_id, code: ins.instructor_code });
      });

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const results: Array<{ instructorCode: string; status: string }> = [];

      for (const row of validRows) {
        const fullName = `${row.firstName.trim()} ${row.lastName.trim()}`.toLowerCase();
        let targetCode = row.instructorCode ? row.instructorCode.trim().toUpperCase() : "";

        // Check if existing by ID or Code or Name
        let existingId: bigint | null = null;
        if (row.existingInstructorId) {
          try {
            existingId = BigInt(row.existingInstructorId);
          } catch {
            existingId = null;
          }
        }

        if (!existingId && targetCode && dbCodes.has(targetCode)) {
          const match = allCurrentInstructors.find(
            (ins) => ins.instructor_code.trim().toUpperCase() === targetCode,
          );
          if (match) existingId = match.instructor_id;
        }

        if (!existingId) {
          const nameMatch = dbNameToIdMap.get(fullName);
          if (nameMatch) {
            existingId = nameMatch.id;
            if (!targetCode) targetCode = nameMatch.code;
          }
        }

        if (existingId) {
          if (overwriteExisting) {
            await prisma.instructor.update({
              where: { instructor_id: existingId },
              data: {
                ...(targetCode ? { instructor_code: targetCode } : {}),
                first_name: row.firstName.trim(),
                last_name: row.lastName.trim(),
                telephone: row.telephone ? row.telephone.trim() : null,
                email: row.email ? row.email.trim() : null,
                education: row.education ? row.education.trim() : null,
                university: row.university ? row.university.trim() : null,
                organization_name: row.organizationName ? row.organizationName.trim() : null,
                status: row.status || "ACTIVE",
              },
            });
            updatedCount++;
            results.push({ instructorCode: targetCode || "UPDATED", status: "UPDATED" });
          } else {
            skippedCount++;
            results.push({ instructorCode: targetCode || "SKIPPED", status: "SKIPPED" });
          }
        } else {
          // Generate new auto code if needed or if code is taken
          if (!targetCode || dbCodes.has(targetCode)) {
            const [newCode] = getNextAutoCodes(existingCodesList, 1);
            targetCode = newCode;
          }

          const created = await prisma.instructor.create({
            data: {
              instructor_code: targetCode,
              first_name: row.firstName.trim(),
              last_name: row.lastName.trim(),
              telephone: row.telephone ? row.telephone.trim() : null,
              email: row.email ? row.email.trim() : null,
              education: row.education ? row.education.trim() : null,
              university: row.university ? row.university.trim() : null,
              organization_name: row.organizationName ? row.organizationName.trim() : null,
              status: row.status || "ACTIVE",
            },
          });

          dbCodes.add(targetCode);
          existingCodesList.push(targetCode);
          dbNameToIdMap.set(fullName, { id: created.instructor_id, code: targetCode });

          createdCount++;
          results.push({ instructorCode: targetCode, status: "CREATED" });
        }
      }

      return apiSuccess({
        success: true,
        createdCount,
        updatedCount,
        skippedCount,
        totalProcessed: validRows.length,
        results,
      });
    } catch (error) {
      console.error("Instructor import error:", error);
      return apiFailure({
        code: "IMPORT_ERROR",
        message: error instanceof Error ? error.message : "Failed to import instructors",
        status: 500,
      });
    }
  },
  {
    allowedRoles: ["HRD_CENTER"],
  },
);
