import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getPrismaClient } from "../../lib/database/prisma";
import { getServerSession } from "../../lib/auth/server-session";

async function deleteImageFileIfPresent(imageUrl: string | undefined | null) {
  if (!imageUrl || typeof imageUrl !== "string") return;
  try {
    let candidateFilename = "";
    if (imageUrl.includes("/api/course-activities/image/")) {
      candidateFilename = imageUrl.split("/api/course-activities/image/")[1];
    } else if (imageUrl.includes("/uploads/activities/")) {
      candidateFilename = imageUrl.split("/uploads/activities/")[1];
    } else if (imageUrl.includes("/")) {
      candidateFilename = imageUrl.split("/").pop() || "";
    } else {
      candidateFilename = imageUrl;
    }

    if (!candidateFilename) return;

    // Strip query parameters and hash
    candidateFilename = candidateFilename.split("?")[0].split("#")[0].trim();

    // Decode URI components and extract basename to avoid path traversal
    const decodedFilename = path.basename(decodeURIComponent(candidateFilename));
    const rawFilename = path.basename(candidateFilename);

    const possibleDirs = [
      path.join(process.cwd(), "public", "uploads", "activities"),
      path.join(process.cwd(), "public", "uploads"),
    ];

    for (const dir of possibleDirs) {
      const filenames = Array.from(new Set([decodedFilename, rawFilename]));
      for (const fn of filenames) {
        if (!fn || fn === "." || fn === "/") continue;
        const targetPath = path.join(dir, fn);
        try {
          await fs.unlink(targetPath);
        } catch {
          // File might not exist in this directory or already deleted
        }
      }
    }
  } catch (err) {
    console.error("Failed to delete image file:", err);
  }
}

export type CourseActivity = {
  id: string;
  title: string;
  date: string;
  formattedDate?: string;
  year: string;
  location?: string;
  description: string;
  imageUrl: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  createdAt: string;
  updatedAt?: string;
};

export type CompanyOption = {
  id: string;
  code: string;
  name: string;
};

const formatDisplayDate = (dateStr: string): { formatted: string; year: string } => {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthName = months[monthNum - 1] || "Jan";
      const formatted = `${String(day).padStart(2, "0")} ${monthName} ${year}`;
      return { formatted, year };
    }
  } catch {
    // fallback
  }
  const fallbackYear = dateStr.slice(0, 4) || new Date().getFullYear().toString();
  return { formatted: dateStr, year: fallbackYear };
};

async function getUserId(): Promise<bigint> {
  try {
    const session = await getServerSession();
    if (session?.userId) {
      return BigInt(session.userId);
    }
  } catch {
    // session lookup fallback
  }

  try {
    const prisma = getPrismaClient();
    const user = await prisma.user_account.findFirst({
      select: { user_id: true },
    });
    if (user?.user_id) {
      return user.user_id;
    }
  } catch (err) {
    console.error("Failed to get fallback user for announcement:", err);
  }

  return BigInt(2); // HRD@CENTER fallback
}

function mapAnnouncementToActivity(row: {
  announcement_id: bigint;
  title: string;
  content: string;
  publish_at: Date;
  status: string;
  company_id?: bigint | null;
  company?: {
    company_id: bigint;
    company_code: string;
    company_name_en?: string | null;
    company_name_th?: string | null;
  } | null;
}): CourseActivity {
  let description = row.content || "";
  let location = "";
  let imageUrl = "";

  try {
    if (row.content && row.content.trim().startsWith("{")) {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === "object") {
        description = parsed.description || "";
        location = parsed.location || "";
        imageUrl = parsed.imageUrl || "";
      }
    }
  } catch {
    // row.content is raw text description
  }

  // Normalize legacy public/uploads path to dynamic image API endpoint
  if (imageUrl && imageUrl.startsWith("/uploads/activities/")) {
    imageUrl = imageUrl.replace(/^\/uploads\/activities\//, "/api/course-activities/image/");
  }

  const isoDate = row.publish_at.toISOString();
  const dateOnly = isoDate.slice(0, 10);
  const { formatted, year } = formatDisplayDate(dateOnly);

  const companyId = row.company_id ? row.company_id.toString() : "center";
  const companyCode = row.company?.company_code || "CENTER";
  const companyName = row.company
    ? `${row.company.company_code} - ${row.company.company_name_en}`
    : "Center (ส่วนกลาง)";

  return {
    id: row.announcement_id.toString(),
    title: row.title,
    date: dateOnly,
    formattedDate: formatted,
    year,
    location,
    description,
    imageUrl,
    companyId,
    companyCode,
    companyName,
    createdAt: isoDate,
  };
}

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const [rows, rawCompanies] = await Promise.all([
      prisma.announcement.findMany({
        where: {
          status: { in: ["PUBLISHED", "DRAFT"] },
        },
        include: {
          company: true,
        },
        orderBy: {
          publish_at: "desc",
        },
      }),
      prisma.company.findMany({
        orderBy: {
          company_id: "asc",
        },
      }),
    ]);

    const companies: CompanyOption[] = [
      { id: "center", code: "CENTER", name: "Center (ส่วนกลาง)" },
      ...rawCompanies.map((c) => ({
        id: c.company_id.toString(),
        code: c.company_code,
        name: `${c.company_code} - ${c.company_name_en}`,
      })),
    ];

    const activities = rows.map(mapAnnouncementToActivity);
    return NextResponse.json({ activities, companies });
  } catch (error) {
    console.error("Failed to read activities from database:", error);
    return NextResponse.json({ error: "Failed to read activities from database" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, date, location, description, imageUrl, companyId } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const userId = await getUserId();
    const prisma = getPrismaClient();

    const content = JSON.stringify({
      description: (description || "").trim(),
      location: (location || "").trim(),
      imageUrl: (imageUrl || "").trim(),
    });

    const dateStr = date || new Date().toISOString().slice(0, 10);
    const publishDate = new Date(`${dateStr}T00:00:00.000Z`);

    const dbCompanyId =
      !companyId || companyId === "center" || companyId === "ALL"
        ? null
        : BigInt(companyId);

    const created = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content,
        publish_at: publishDate,
        status: "PUBLISHED",
        target_role: "ALL",
        created_by: userId,
        company_id: dbCompanyId,
      },
      include: {
        company: true,
      },
    });

    const newActivity = mapAnnouncementToActivity(created);
    return NextResponse.json({ activity: newActivity }, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity in database:", error);
    return NextResponse.json({ error: "Failed to create activity in database" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, date, location, description, imageUrl, companyId } = body;

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const existing = await prisma.announcement.findUnique({
      where: { announcement_id: BigInt(id) },
    });

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    let existingMeta = { description: "", location: "", imageUrl: "" };
    try {
      if (existing.content && existing.content.trim().startsWith("{")) {
        existingMeta = { ...existingMeta, ...JSON.parse(existing.content) };
      } else {
        existingMeta.description = existing.content;
      }
    } catch {
      // ignore
    }

    const newContent = JSON.stringify({
      description: description !== undefined ? description.trim() : existingMeta.description,
      location: location !== undefined ? location.trim() : existingMeta.location,
      imageUrl: imageUrl !== undefined ? imageUrl.trim() : existingMeta.imageUrl,
    });

    const updateData: {
      title?: string;
      content: string;
      publish_at?: Date;
      company_id?: bigint | null;
    } = {
      content: newContent,
    };
    if (title !== undefined && title.trim()) {
      updateData.title = title.trim();
    }
    if (date) {
      updateData.publish_at = new Date(`${date}T00:00:00.000Z`);
    }
    if (companyId !== undefined) {
      updateData.company_id =
        companyId === "center" || !companyId || companyId === "ALL"
          ? null
          : BigInt(companyId);
    }

    // If image was changed or removed, delete the old image file from server
    if (imageUrl !== undefined && existingMeta.imageUrl && existingMeta.imageUrl !== imageUrl.trim()) {
      await deleteImageFileIfPresent(existingMeta.imageUrl);
    }

    const updated = await prisma.announcement.update({
      where: { announcement_id: BigInt(id) },
      data: updateData,
      include: {
        company: true,
      },
    });

    return NextResponse.json({ activity: mapAnnouncementToActivity(updated) });
  } catch (error) {
    console.error("Failed to update activity in database:", error);
    return NextResponse.json({ error: "Failed to update activity in database" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const queryImageUrl = searchParams.get("imageUrl");

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    const prisma = getPrismaClient();

    const existing = await prisma.announcement.findUnique({
      where: { announcement_id: BigInt(id) },
    });

    let imageToDelete = queryImageUrl || "";

    if (existing) {
      try {
        if (existing.content && existing.content.trim().startsWith("{")) {
          const meta = JSON.parse(existing.content);
          if (meta.imageUrl) {
            imageToDelete = meta.imageUrl;
          }
        }
      } catch {
        // ignore
      }

      await prisma.announcement.delete({
        where: { announcement_id: BigInt(id) },
      });
    }

    if (imageToDelete) {
      await deleteImageFileIfPresent(imageToDelete);
    }
    if (queryImageUrl && queryImageUrl !== imageToDelete) {
      await deleteImageFileIfPresent(queryImageUrl);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Failed to delete activity from database:", error);
    return NextResponse.json({ error: "Failed to delete activity from database" }, { status: 500 });
  }
}
