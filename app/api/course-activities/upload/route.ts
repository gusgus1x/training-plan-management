import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".bmp",
  ".avif",
  ".tiff",
  ".tif",
  ".ico",
]);

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const rawFiles = data.getAll("files") as unknown as File[];
    const singleFile = data.get("file") as unknown as File | null;
    const filesToProcess: File[] = rawFiles.length > 0 ? rawFiles : singleFile ? [singleFile] : [];

    if (filesToProcess.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "activities");
    await fs.mkdir(uploadDir, { recursive: true });

    const uploadedUrls: string[] = [];

    for (const file of filesToProcess) {
      const rawExt = path.extname(file.name || "").toLowerCase();
      const ext = rawExt || (file.type === "image/png" ? ".png" : ".jpg");
      const isImageMime = Boolean(file.type && file.type.startsWith("image/"));
      const isImageExt = ALLOWED_EXTENSIONS.has(ext);

      if (!isImageMime && !isImageExt) {
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Sanitize filename and make unique
      const baseName = path
        .basename(file.name, rawExt)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 30);
      const uniqueFilename = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${baseName || "activity"}${ext}`;

      const filePath = path.join(uploadDir, uniqueFilename);
      await fs.writeFile(filePath, buffer);

      const publicUrl = `/api/course-activities/image/${uniqueFilename}`;
      uploadedUrls.push(publicUrl);
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์รูปภาพ (.jpg, .jpeg, .jfif, .png, .webp, .gif, .svg, .bmp, .avif)" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url: uploadedUrls[0],
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
