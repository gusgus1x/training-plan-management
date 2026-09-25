import { NextResponse } from "next/server";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { buildScheduleCalendarWorkbook, parseCalendarExportInput } from "../../../lib/scheduleCalendarWorkbook";

export const runtime = "nodejs";

// Draws the Schedule Calendar the page already laid out, so it carries no data the caller could
// not see. Any signed-in role: employees have the same Export button on their calendar.
export const POST = createProtectedRoute(async (request) => {
  let input;
  try {
    input = parseCalendarExportInput(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ข้อมูลปฏิทินไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const workbook = buildScheduleCalendarWorkbook(input);
  const month = input.months.length === 1 ? String(input.months[0].month).padStart(2, "0") : "all-year";
  const fileName = `training-schedule-${input.year}-${month}.xlsx`;

  // NextResponse, not Response: the guard rolls the session cookie on whatever comes back.
  return new NextResponse(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
