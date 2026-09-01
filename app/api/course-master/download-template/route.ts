import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    let filePath = path.join(process.cwd(), "app", "Excel", "Master Course Import Tem.xlsx");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), "app", "Excel", "Course Master Create Tem.xlsx");
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Template file not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Master_Course_Import_Template.xlsx"',
      },
    });
  } catch (error) {
    console.error("Failed to download template:", error);
    return NextResponse.json({ error: "Failed to download template" }, { status: 500 });
  }
}
