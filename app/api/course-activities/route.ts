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
  images?: string[];
  isCourseLinked?: boolean;
  linkedCourseId?: string | null;
  linkedCourseCode?: string | null;
  linkedCourseName?: string | null;
  linkedPlanId?: string | null;
  linkedTrainingDate?: string | null;
  linkedEndDate?: string | null;
  registrationNote?: string | null;
  isVisibleOnDashboard?: boolean;
  showOnLoginPage?: boolean;
  status?: string;
  sortOrder?: number;
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

function parseActivityDate(dateStr?: string | null): Date {
  if (!dateStr || typeof dateStr !== "string") {
    return new Date();
  }
  const trimmed = dateStr.trim();
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }
  // If DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\-]/).map(Number);
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime())) return d;
  }
  // If YYYY/MM/DD
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\-]/).map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  return new Date();
}

async function resolveCompanyId(companyIdVal: unknown): Promise<bigint | null> {
  if (!companyIdVal || companyIdVal === "center" || companyIdVal === "ALL") {
    return null;
  }
  const str = String(companyIdVal).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) {
    return BigInt(str);
  }
  // If passed as code (e.g. "SATI", "ATFB")
  try {
    const prisma = getPrismaClient();
    const comp = await prisma.company.findFirst({
      where: { company_code: str },
      select: { company_id: true },
    });
    if (comp) return comp.company_id;
  } catch {
    // ignore
  }
  return null;
}

async function getUserId(): Promise<bigint> {
  try {
    const session = await getServerSession();
    if (session?.userId && /^\d+$/.test(String(session.userId))) {
      const prisma = getPrismaClient();
      const user = await prisma.user_account.findUnique({
        where: { user_id: BigInt(session.userId) },
        select: { user_id: true },
      });
      if (user?.user_id) {
        return user.user_id;
      }
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
  let images: string[] = [];
  let isCourseLinked = false;
  let linkedCourseId: string | null = null;
  let linkedCourseCode: string | null = null;
  let linkedCourseName: string | null = null;
  let linkedPlanId: string | null = null;
  let linkedTrainingDate: string | null = null;
  let linkedEndDate: string | null = null;
  let registrationNote: string | null = null;
  let isVisibleOnDashboard = true;
  let showOnLoginPage = false;
  let sortOrder: number | undefined = undefined;

  try {
    if (row.content && row.content.trim().startsWith("{")) {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === "object") {
        description = parsed.description || "";
        location = parsed.location || "";
        imageUrl = parsed.imageUrl || "";
        if (Array.isArray(parsed.images)) {
          images = parsed.images
            .filter((img: unknown) => typeof img === "string" && img.trim())
            .map((img: string) =>
              img.startsWith("/uploads/activities/")
                ? img.replace(/^\/uploads\/activities\//, "/api/course-activities/image/")
                : img.trim()
            );
        }
        isCourseLinked = Boolean(parsed.isCourseLinked);
        linkedCourseId = parsed.linkedCourseId ? String(parsed.linkedCourseId) : null;
        linkedCourseCode = parsed.linkedCourseCode ? String(parsed.linkedCourseCode) : null;
        linkedCourseName = parsed.linkedCourseName ? String(parsed.linkedCourseName) : null;
        linkedPlanId = parsed.linkedPlanId ? String(parsed.linkedPlanId) : null;
        linkedTrainingDate = parsed.linkedTrainingDate ? String(parsed.linkedTrainingDate) : null;
        linkedEndDate = parsed.linkedEndDate ? String(parsed.linkedEndDate) : null;
        registrationNote = parsed.registrationNote ? String(parsed.registrationNote) : null;
        if (parsed.isVisibleOnDashboard !== undefined) {
          isVisibleOnDashboard = Boolean(parsed.isVisibleOnDashboard);
        } else if (row.status === "INACTIVE" || row.status === "ARCHIVED") {
          isVisibleOnDashboard = false;
        }
        if (parsed.showOnLoginPage !== undefined) {
          showOnLoginPage = Boolean(parsed.showOnLoginPage);
        }
        if (parsed.sortOrder !== undefined && typeof parsed.sortOrder === "number") {
          sortOrder = parsed.sortOrder;
        }
      }
    }
  } catch {
    // row.content is raw text description
  }

  // Normalize legacy public/uploads path to dynamic image API endpoint
  if (imageUrl && imageUrl.startsWith("/uploads/activities/")) {
    imageUrl = imageUrl.replace(/^\/uploads\/activities\//, "/api/course-activities/image/");
  }

  // Ensure images array includes imageUrl if images was empty
  if (images.length === 0 && imageUrl) {
    images = [imageUrl];
  } else if (images.length > 0 && !imageUrl) {
    imageUrl = images[0];
  }

  const isoDate = row.publish_at.toISOString();
  const dateOnly = isoDate.slice(0, 10);
  const { formatted, year } = formatDisplayDate(dateOnly);

  const companyId = row.company_id ? row.company_id.toString() : "center";
  const companyCode = row.company?.company_code || "CENTER";
  const companyName = row.company
    ? `${row.company.company_code} - ${row.company.company_name_en}`
    : "Center (ส่วนกลาง)";

  const isVisibleSomewhere = isVisibleOnDashboard || showOnLoginPage;
  const activityStatus =
    row.status === "INACTIVE" || row.status === "ARCHIVED" || !isVisibleSomewhere
      ? "ARCHIVED"
      : row.status || "PUBLISHED";
  if (activityStatus === "ARCHIVED") {
    isVisibleOnDashboard = false;
    showOnLoginPage = false;
  }

  return {
    id: row.announcement_id.toString(),
    title: row.title,
    date: dateOnly,
    formattedDate: formatted,
    year,
    location,
    description,
    imageUrl,
    images,
    isCourseLinked,
    linkedCourseId,
    linkedCourseCode,
    linkedCourseName,
    linkedPlanId,
    linkedTrainingDate,
    linkedEndDate,
    registrationNote,
    isVisibleOnDashboard,
    showOnLoginPage,
    status: activityStatus,
    sortOrder,
    companyId,
    companyCode,
    companyName,
    createdAt: isoDate,
  };
}

export async function GET() {
  try {
    const session = await getServerSession().catch(() => null);
    const isFactory = session?.role === "HRD_FACTORY";
    const isEmployee = session?.role === "EMPLOYEE";
    const factoryCompanyId = session?.companyId ? BigInt(session.companyId) : null;

    const isUnauthenticated = !session;
    const where: any = {
      status: isUnauthenticated ? "PUBLISHED" : { in: ["PUBLISHED", "DRAFT", "INACTIVE"] },
    };

    if ((isFactory || isEmployee) && factoryCompanyId) {
      where.OR = [
        { company_id: null },
        { company_id: factoryCompanyId },
      ];
    }

    const prisma = getPrismaClient();
    const [rows, rawCompanies] = await Promise.all([
      prisma.announcement.findMany({
        where,
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

    let filteredRawCompanies = rawCompanies;
    if ((isFactory || isEmployee) && factoryCompanyId) {
      filteredRawCompanies = rawCompanies.filter(
        (c) => c.company_id === factoryCompanyId
      );
    }

    const companies: CompanyOption[] = [
      { id: "center", code: "CENTER", name: "Center (ส่วนกลาง)" },
      ...filteredRawCompanies.map((c) => ({
        id: c.company_id.toString(),
        code: c.company_code,
        name: `${c.company_code} - ${c.company_name_en}`,
      })),
    ];

    let activities = rows.map(mapAnnouncementToActivity);
    if (isUnauthenticated) {
      activities = activities.filter(
        (a) => a.isVisibleOnDashboard !== false && a.status === "PUBLISHED"
      );
    }

    // Sort order:
    // 1. sortOrder (ascending: 0, 1, 2... custom order from Dashboard)
    // 2. publish_at / createdAt descending
    activities.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
      if (orderA !== orderB) return orderA - orderB;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({ activities, companies });
  } catch (error) {
    console.error("Failed to read activities from database:", error);
    return NextResponse.json({ error: "Failed to read activities from database" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      date,
      location,
      description,
      imageUrl,
      images,
      isCourseLinked,
      linkedCourseId,
      linkedCourseCode,
      linkedCourseName,
      linkedPlanId,
      linkedTrainingDate,
      linkedEndDate,
      registrationNote,
      isVisibleOnDashboard,
      showOnLoginPage,
      status,
      sortOrder,
      companyId,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const session = await getServerSession().catch(() => null);
    const isFactory = session?.role === "HRD_FACTORY";
    const isEmployee = session?.role === "EMPLOYEE";

    if (isEmployee) {
      return NextResponse.json({ error: "Forbidden: Employees cannot create activities" }, { status: 403 });
    }

    const userId = await getUserId();
    const prisma = getPrismaClient();

    const targetActivityCompanyId =
      isFactory && session?.companyId
        ? BigInt(session.companyId)
        : await resolveCompanyId(companyId);

    if (isCourseLinked && linkedPlanId) {
      const planRow = await prisma.training_plan.findUnique({
        where: { plan_id: BigInt(linkedPlanId) },
        include: { training_plan_oap: true },
      });
      const planCompanyId = planRow?.training_plan_oap?.company_id ?? null;
      if (targetActivityCompanyId !== null) {
        if (planCompanyId !== targetActivityCompanyId) {
          return NextResponse.json(
            { error: "Forbidden: Cannot link training course of another company" },
            { status: 403 }
          );
        }
      } else {
        if (planCompanyId !== null) {
          return NextResponse.json(
            { error: "Forbidden: Center activity can only link to Center training course" },
            { status: 403 }
          );
        }
      }
    }

    let imageList: string[] = [];
    if (Array.isArray(images)) {
      imageList = images.filter((img: unknown) => typeof img === "string" && img.trim());
    }
    const primaryImageUrl = (imageUrl || (imageList.length > 0 ? imageList[0] : "") || "").trim();
    if (primaryImageUrl && !imageList.includes(primaryImageUrl)) {
      imageList.unshift(primaryImageUrl);
    }

    const showOnDashboard =
      isVisibleOnDashboard !== undefined
        ? Boolean(isVisibleOnDashboard)
        : status !== "ARCHIVED" && status !== "INACTIVE";
    const showOnLogin = Boolean(showOnLoginPage);
    const isVisibleSomewhere = showOnDashboard || showOnLogin;
    const dbStatus = isVisibleSomewhere ? "PUBLISHED" : "INACTIVE";

    const content = JSON.stringify({
      description: (description || "").trim(),
      location: (location || "").trim(),
      imageUrl: primaryImageUrl,
      images: imageList,
      isCourseLinked: Boolean(isCourseLinked),
      linkedCourseId: linkedCourseId ? String(linkedCourseId).trim() : null,
      linkedCourseCode: linkedCourseCode ? String(linkedCourseCode).trim() : null,
      linkedCourseName: linkedCourseName ? String(linkedCourseName).trim() : null,
      linkedPlanId: linkedPlanId ? String(linkedPlanId).trim() : null,
      linkedTrainingDate: linkedTrainingDate ? String(linkedTrainingDate).trim() : null,
      linkedEndDate: linkedEndDate ? String(linkedEndDate).trim() : null,
      registrationNote: registrationNote ? String(registrationNote).trim() : null,
      isVisibleOnDashboard: showOnDashboard,
      showOnLoginPage: showOnLogin,
      status: isVisibleSomewhere ? "PUBLISHED" : "ARCHIVED",
      sortOrder: typeof sortOrder === "number" ? sortOrder : undefined,
    });

    const publishDate = parseActivityDate(date);
    const dbCompanyId = targetActivityCompanyId;

    const created = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content,
        publish_at: publishDate,
        status: dbStatus,
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
    const {
      id,
      title,
      date,
      location,
      description,
      imageUrl,
      images,
      isCourseLinked,
      linkedCourseId,
      linkedCourseCode,
      linkedCourseName,
      linkedPlanId,
      linkedTrainingDate,
      linkedEndDate,
      registrationNote,
      isVisibleOnDashboard,
      showOnLoginPage,
      status,
      sortOrder,
      companyId,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    const session = await getServerSession().catch(() => null);
    const isFactory = session?.role === "HRD_FACTORY";
    const isEmployee = session?.role === "EMPLOYEE";

    if (isEmployee) {
      return NextResponse.json({ error: "Forbidden: Employees cannot update activities" }, { status: 403 });
    }

    const prisma = getPrismaClient();
    const existing = await prisma.announcement.findUnique({
      where: { announcement_id: BigInt(id) },
    });

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (isFactory && session?.companyId) {
      if (existing.company_id !== BigInt(session.companyId)) {
        return NextResponse.json(
          { error: "Forbidden: Cannot modify activities of other companies" },
          { status: 403 }
        );
      }
    }

    let existingMeta: {
      description?: string;
      location?: string;
      imageUrl?: string;
      images?: string[];
      isCourseLinked?: boolean;
      linkedCourseId?: string | null;
      linkedCourseCode?: string | null;
      linkedCourseName?: string | null;
      linkedPlanId?: string | null;
      linkedTrainingDate?: string | null;
      linkedEndDate?: string | null;
      registrationNote?: string | null;
      isVisibleOnDashboard?: boolean;
      showOnLoginPage?: boolean;
      status?: string;
      sortOrder?: number;
    } = { description: "", location: "", imageUrl: "", images: [] };

    try {
      if (existing.content && existing.content.trim().startsWith("{")) {
        existingMeta = { ...existingMeta, ...JSON.parse(existing.content) };
      } else {
        existingMeta.description = existing.content;
      }
    } catch {
      // ignore
    }

    let imageList: string[] = [];
    if (Array.isArray(images)) {
      imageList = images.filter((img: unknown) => typeof img === "string" && img.trim());
    } else if (Array.isArray(existingMeta.images)) {
      imageList = existingMeta.images;
    }

    let finalImageUrl = imageUrl !== undefined ? imageUrl.trim() : (existingMeta.imageUrl || "");
    if (!finalImageUrl && imageList.length > 0) {
      finalImageUrl = imageList[0];
    }
    if (finalImageUrl && !imageList.includes(finalImageUrl)) {
      imageList.unshift(finalImageUrl);
    }

    const targetActivityCompanyId =
      isFactory && session?.companyId
        ? BigInt(session.companyId)
        : companyId !== undefined
          ? await resolveCompanyId(companyId)
          : existing.company_id ?? null;

    if (isCourseLinked && linkedPlanId) {
      const planRow = await prisma.training_plan.findUnique({
        where: { plan_id: BigInt(linkedPlanId) },
        include: { training_plan_oap: true },
      });
      const planCompanyId = planRow?.training_plan_oap?.company_id ?? null;
      if (targetActivityCompanyId !== null) {
        if (planCompanyId !== targetActivityCompanyId) {
          return NextResponse.json(
            { error: "Forbidden: Cannot link training course of another company" },
            { status: 403 }
          );
        }
      } else {
        if (planCompanyId !== null) {
          return NextResponse.json(
            { error: "Forbidden: Center activity can only link to Center training course" },
            { status: 403 }
          );
        }
      }
    }

    const showOnDashboard =
      isVisibleOnDashboard !== undefined
        ? Boolean(isVisibleOnDashboard)
        : status !== undefined
        ? status !== "ARCHIVED" && status !== "INACTIVE" && status !== "Draft"
        : existingMeta.isVisibleOnDashboard !== undefined
        ? Boolean(existingMeta.isVisibleOnDashboard)
        : existing.status !== "INACTIVE" && existing.status !== "ARCHIVED";

    const showOnLogin =
      showOnLoginPage !== undefined
        ? Boolean(showOnLoginPage)
        : existingMeta.showOnLoginPage !== undefined
        ? Boolean(existingMeta.showOnLoginPage)
        : false;

    const isVisibleSomewhere = showOnDashboard || showOnLogin;
    const dbStatus = isVisibleSomewhere ? "PUBLISHED" : "INACTIVE";

    const newContent = JSON.stringify({
      description: description !== undefined ? description.trim() : (existingMeta.description || ""),
      location: location !== undefined ? location.trim() : (existingMeta.location || ""),
      imageUrl: finalImageUrl,
      images: imageList,
      isCourseLinked: isCourseLinked !== undefined ? Boolean(isCourseLinked) : Boolean(existingMeta.isCourseLinked),
      linkedCourseId: linkedCourseId !== undefined ? (linkedCourseId ? String(linkedCourseId).trim() : null) : (existingMeta.linkedCourseId || null),
      linkedCourseCode: linkedCourseCode !== undefined ? (linkedCourseCode ? String(linkedCourseCode).trim() : null) : (existingMeta.linkedCourseCode || null),
      linkedCourseName: linkedCourseName !== undefined ? (linkedCourseName ? String(linkedCourseName).trim() : null) : (existingMeta.linkedCourseName || null),
      linkedPlanId: linkedPlanId !== undefined ? (linkedPlanId ? String(linkedPlanId).trim() : null) : (existingMeta.linkedPlanId || null),
      linkedTrainingDate: linkedTrainingDate !== undefined ? (linkedTrainingDate ? String(linkedTrainingDate).trim() : null) : (existingMeta.linkedTrainingDate || null),
      linkedEndDate: linkedEndDate !== undefined ? (linkedEndDate ? String(linkedEndDate).trim() : null) : (existingMeta.linkedEndDate || null),
      registrationNote: registrationNote !== undefined ? (registrationNote ? String(registrationNote).trim() : null) : (existingMeta.registrationNote || null),
      isVisibleOnDashboard: showOnDashboard,
      showOnLoginPage: showOnLogin,
      status: isVisibleSomewhere ? "PUBLISHED" : "ARCHIVED",
      sortOrder: sortOrder !== undefined ? (typeof sortOrder === "number" ? sortOrder : undefined) : existingMeta.sortOrder,
    });

    const updateData: {
      title?: string;
      content: string;
      publish_at?: Date;
      company_id?: bigint | null;
      status?: string;
    } = {
      content: newContent,
      status: dbStatus,
    };
    if (title !== undefined && title.trim()) {
      updateData.title = title.trim();
    }
    if (date) {
      updateData.publish_at = parseActivityDate(date);
    }
    if (companyId !== undefined) {
      updateData.company_id = targetActivityCompanyId;
    }

    // If images were removed from existing set, delete them from disk
    const existingImages = new Set<string>();
    if (existingMeta.imageUrl) existingImages.add(existingMeta.imageUrl);
    if (Array.isArray(existingMeta.images)) {
      existingMeta.images.forEach((img) => existingImages.add(img));
    }
    const currentImages = new Set<string>(imageList);
    if (finalImageUrl) currentImages.add(finalImageUrl);

    for (const oldImg of existingImages) {
      if (!currentImages.has(oldImg)) {
        await deleteImageFileIfPresent(oldImg);
      }
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

    const session = await getServerSession().catch(() => null);
    const isFactory = session?.role === "HRD_FACTORY";
    const isEmployee = session?.role === "EMPLOYEE";

    if (isEmployee) {
      return NextResponse.json({ error: "Forbidden: Employees cannot delete activities" }, { status: 403 });
    }

    const prisma = getPrismaClient();

    const existing = await prisma.announcement.findUnique({
      where: { announcement_id: BigInt(id) },
    });

    if (!existing) {
      return NextResponse.json({ success: true, deletedId: id });
    }

    if (isFactory && session?.companyId) {
      if (existing.company_id !== BigInt(session.companyId)) {
        return NextResponse.json(
          { error: "Forbidden: Cannot delete activities of other companies" },
          { status: 403 }
        );
      }
    }

    const imagesToDelete = new Set<string>();
    if (queryImageUrl) imagesToDelete.add(queryImageUrl);

    try {
      if (existing.content && existing.content.trim().startsWith("{")) {
        const meta = JSON.parse(existing.content);
        if (meta.imageUrl) imagesToDelete.add(meta.imageUrl);
        if (Array.isArray(meta.images)) {
          meta.images.forEach((img: string) => imagesToDelete.add(img));
        }
      }
    } catch {
      // ignore
    }

    await prisma.announcement.delete({
      where: { announcement_id: BigInt(id) },
    });

    for (const img of imagesToDelete) {
      await deleteImageFileIfPresent(img);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Failed to delete activity from database:", error);
    return NextResponse.json({ error: "Failed to delete activity from database" }, { status: 500 });
  }
}

// PATCH endpoint: Quick toggle pin status or batch update reorder sequence
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    const isFactory = session?.role === "HRD_FACTORY";
    const isEmployee = session?.role === "EMPLOYEE";

    if (isEmployee) {
      return NextResponse.json({ error: "Forbidden: Employees cannot reorder or pin activities" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const prisma = getPrismaClient();

    // Mode 1: Move single activity to First Position ({ moveToFirstId: string } or { id, moveToFirst: true })
    const targetMoveFirstId = body.moveToFirstId
      ? String(body.moveToFirstId)
      : body.moveToFirst && body.id
      ? String(body.id)
      : null;

    if (targetMoveFirstId) {
      const existing = await prisma.announcement.findUnique({
        where: { announcement_id: BigInt(targetMoveFirstId) },
      });

      if (!existing) {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      }

      if (isFactory && session?.companyId && existing.company_id !== BigInt(session.companyId)) {
        return NextResponse.json(
          { error: "Forbidden: Cannot modify activities of other companies" },
          { status: 403 }
        );
      }

      // Fetch all announcements in the current scope
      const scopeWhere: any = {};
      if (isFactory && session?.companyId) {
        scopeWhere.company_id = BigInt(session.companyId);
      }
      const allScope = await prisma.announcement.findMany({
        where: scopeWhere,
        orderBy: { publish_at: "desc" },
      });

      const sorted = allScope.map((item) => {
        let meta: any = {};
        try {
          if (item.content && item.content.trim().startsWith("{")) {
            meta = JSON.parse(item.content);
          }
        } catch {}
        return {
          announcement_id: item.announcement_id,
          sortOrder: typeof meta.sortOrder === "number" ? meta.sortOrder : 999999,
          content: item.content,
        };
      });

      sorted.sort((a, b) => a.sortOrder - b.sortOrder);

      const targetItem = sorted.find((it) => it.announcement_id.toString() === targetMoveFirstId);
      const remainingItems = sorted.filter((it) => it.announcement_id.toString() !== targetMoveFirstId);
      const reorderedList = targetItem ? [targetItem, ...remainingItems] : sorted;

      await Promise.all(
        reorderedList.map(async (item, newIndex) => {
          let meta: any = {};
          try {
            if (item.content && item.content.trim().startsWith("{")) {
              meta = JSON.parse(item.content);
            } else {
              meta = { description: item.content };
            }
          } catch {
            meta = { description: item.content };
          }
          meta.sortOrder = newIndex;
          delete meta.isPinned;

          await prisma.announcement.update({
            where: { announcement_id: item.announcement_id },
            data: { content: JSON.stringify(meta) },
          });
        })
      );

      return NextResponse.json({ success: true, movedId: targetMoveFirstId });
    }

    // Mode 2: Batch Reorder activities ({ reorderedIds: string[] })
    if (Array.isArray(body.reorderedIds) && body.reorderedIds.length > 0) {
      const ids: string[] = body.reorderedIds.map(String);

      const announcements = await prisma.announcement.findMany({
        where: {
          announcement_id: { in: ids.map((id) => BigInt(id)) },
        },
      });

      // Update sortOrder for each announcement
      await Promise.all(
        announcements.map(async (item) => {
          // If HRD Factory, skip items not belonging to their company
          if (isFactory && session?.companyId && item.company_id !== BigInt(session.companyId)) {
            return;
          }

          const targetOrder = ids.indexOf(item.announcement_id.toString());
          if (targetOrder === -1) return;

          let meta: any = {};
          try {
            if (item.content && item.content.trim().startsWith("{")) {
              meta = JSON.parse(item.content);
            } else {
              meta = { description: item.content };
            }
          } catch {
            meta = { description: item.content };
          }

          meta.sortOrder = targetOrder;
          delete meta.isPinned;

          await prisma.announcement.update({
            where: { announcement_id: item.announcement_id },
            data: {
              content: JSON.stringify(meta),
            },
          });
        })
      );

      return NextResponse.json({ success: true, count: ids.length });
    }

    // Mode 3: Quick toggle showOnLoginPage ({ toggleLoginPageId: string } or { id, showOnLoginPage: boolean })
    const targetLoginPageId = body.toggleLoginPageId
      ? String(body.toggleLoginPageId)
      : body.id && body.showOnLoginPage !== undefined
      ? String(body.id)
      : null;

    if (targetLoginPageId) {
      const existing = await prisma.announcement.findUnique({
        where: { announcement_id: BigInt(targetLoginPageId) },
        include: { company: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      }

      if (isFactory && session?.companyId && existing.company_id !== BigInt(session.companyId)) {
        return NextResponse.json(
          { error: "Forbidden: Cannot modify activities of other companies" },
          { status: 403 }
        );
      }

      let meta: any = {};
      try {
        if (existing.content && existing.content.trim().startsWith("{")) {
          meta = JSON.parse(existing.content);
        } else {
          meta = { description: existing.content };
        }
      } catch {
        meta = { description: existing.content };
      }

      const nextShow =
        body.showOnLoginPage !== undefined
          ? Boolean(body.showOnLoginPage)
          : !meta.showOnLoginPage;

      meta.showOnLoginPage = nextShow;

      const isVisibleSomewhere = Boolean(meta.isVisibleOnDashboard) || nextShow;
      const dbStatus = isVisibleSomewhere ? "PUBLISHED" : "INACTIVE";

      const updated = await prisma.announcement.update({
        where: { announcement_id: BigInt(targetLoginPageId) },
        data: {
          content: JSON.stringify(meta),
          status: dbStatus,
        },
        include: { company: true },
      });

      const updatedActivity = mapAnnouncementToActivity(updated);
      return NextResponse.json({ success: true, activity: updatedActivity, showOnLoginPage: nextShow });
    }

    return NextResponse.json({ error: "Invalid PATCH request body" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update activity ordering in database:", error);
    return NextResponse.json({ error: "Failed to update activity ordering" }, { status: 500 });
  }
}

