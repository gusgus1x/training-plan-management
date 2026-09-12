import { NextRequest, NextResponse } from "next/server";
import {
  buildInstructorCsvTemplate,
  buildInstructorXlsxTemplate,
} from "../../../../lib/instructors/instructorTemplate";

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "csv") {
      const csvString = buildInstructorCsvTemplate();
      return new NextResponse(csvString, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="Instructor_Import_Template.csv"',
        },
      });
    }

    const xlsxBuffer = buildInstructorXlsxTemplate();
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Instructor_Import_Template.xlsx"',
      },
    });
  } catch (error) {
    console.error("Failed to generate instructor template:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 },
    );
  }
}
