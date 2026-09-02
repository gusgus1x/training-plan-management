import fs from "fs";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { courseService } from "../../../lib/courses/service";
import {
  buildCourseMasterExportWorkbook,
  buildCompanyCourseMasterExportZip,
  type CourseExportRecord,
} from "../../../lib/courseMasterExport";

export const runtime = "nodejs";

export const GET = createProtectedRoute(
  async (request: NextRequest, principal) => {
    try {
      const templatePath = path.join(
        process.cwd(),
        "app",
        "Excel",
        "Master Course Import Tem.xlsx",
      );

      if (!fs.existsSync(templatePath)) {
        return NextResponse.json(
          { error: "Template file not found" },
          { status: 404 },
        );
      }

      const templateBuffer = fs.readFileSync(templatePath);

      // Parse query params
      const { searchParams } = new URL(request.url);
      const requestedCompany = (searchParams.get("companyCode") || "").trim();
      const mode = (searchParams.get("mode") || "").trim().toLowerCase();

      // Fetch courses and standards
      const companyId =
        principal.role === "HRD_FACTORY" ? principal.companyId : null;
      const { courses, standards } = await courseService.listCourses(
        { search: null, status: null },
        companyId,
      );

      const standardsByCourse = new Map<
        string,
        { levels: string[]; positions: string[] }
      >();
      (standards || []).forEach((st) => {
        const key = st.courseId || st.courseCode;
        if (key) {
          standardsByCourse.set(key, {
            levels: Array.isArray(st.levels) ? st.levels : [],
            positions: Array.isArray(st.positions) ? st.positions : [],
          });
        }
      });

      const exportItemsWithCompany = courses.map((course) => {
        const st =
          standardsByCourse.get(course.id) ||
          standardsByCourse.get(course.courseCode);
        const targetCompanies = Array.isArray(
          (course as unknown as { targetCompanies?: string[] }).targetCompanies,
        )
          ? (course as unknown as { targetCompanies: string[] }).targetCompanies
          : [];
        const ownerCompany = (
          course.ownerCompany || (course.owner === "CENTER" ? "CENTER" : "")
        ).trim();

        return {
          record: {
            courseCode: course.courseCode,
            courseNameTh: course.courseNameTh,
            courseNameEn: course.courseNameEn,
            courseGroup: course.courseGroup,
            courseType: course.courseType,
            objective: course.objective,
            learningContent: course.learningContent,
            targetGroup: course.targetGroup,
            methodology: course.methodology,
            levels: st?.levels || [],
            positions: st?.positions || [],
          } satisfies CourseExportRecord,
          ownerCompany: ownerCompany || "CENTER",
          targetCompanies,
        };
      });

      const courseMatchesCompany = (
        item: (typeof exportItemsWithCompany)[number],
        code: string,
      ): boolean => {
        if (!code || code === "ALL") return true;
        const upperCode = code.toUpperCase();
        if (upperCode === "CENTER" || upperCode === "HRD CENTER") {
          return (
            item.ownerCompany === "CENTER" ||
            item.ownerCompany === "HRD Center" ||
            !item.ownerCompany
          );
        }
        return (
          item.ownerCompany === code ||
          item.targetCompanies.includes(code) ||
          item.record.courseCode.startsWith(`${code}-`)
        );
      };

      const dateStr = new Date().toISOString().slice(0, 10);

      // 1. ZIP Mode: Separate file per company
      if (mode === "zip") {
        // Collect distinct company codes
        const companySet = new Set<string>();
        exportItemsWithCompany.forEach((item) => {
          if (item.ownerCompany) companySet.add(item.ownerCompany);
          item.targetCompanies.forEach((tc) => {
            if (tc) companySet.add(tc);
          });
        });

        // Ensure CENTER is present if any center courses exist
        if (
          exportItemsWithCompany.some((item) =>
            courseMatchesCompany(item, "CENTER"),
          )
        ) {
          companySet.add("CENTER");
        }

        const companyMap = new Map<string, CourseExportRecord[]>();
        const orderedCompanies = Array.from(companySet).sort((a, b) => {
          if (a === "CENTER") return -1;
          if (b === "CENTER") return 1;
          return a.localeCompare(b);
        });

        orderedCompanies.forEach((code) => {
          const matched = exportItemsWithCompany
            .filter((item) => courseMatchesCompany(item, code))
            .map((item) => item.record);
          if (matched.length > 0) {
            companyMap.set(code, matched);
          }
        });

        const zipBuffer = buildCompanyCourseMasterExportZip(
          templateBuffer,
          companyMap,
          dateStr,
        );

        const zipFilename = `Master_Course_Export_All_Companies_${dateStr}.zip`;
        const encodedZipFilename = encodeURIComponent(zipFilename);

        return new NextResponse(new Uint8Array(zipBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodedZipFilename}`,
            "Cache-Control": "no-store",
          },
        });
      }

      // 2. Single Excel Mode: (Filtered by specific company or All in one)
      const isFiltered = requestedCompany && requestedCompany !== "ALL";
      const filteredRecords = isFiltered
        ? exportItemsWithCompany
            .filter((item) => courseMatchesCompany(item, requestedCompany))
            .map((item) => item.record)
        : exportItemsWithCompany.map((item) => item.record);

      const outputBuffer = buildCourseMasterExportWorkbook(
        templateBuffer,
        filteredRecords,
      );

      const companySuffix = isFiltered ? `_${requestedCompany}` : "_All";
      const filename = `Master_Course_Export${companySuffix}_${dateStr}.xlsx`;
      const encodedFilename = encodeURIComponent(filename);

      return new NextResponse(new Uint8Array(outputBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("Course export error:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to export Course Master",
        },
        { status: 500 },
      );
    }
  },
  { allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] },
);
