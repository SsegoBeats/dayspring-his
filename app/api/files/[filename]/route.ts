import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

// Serve uploaded files from the private uploads directory.
// Only authenticated users with documents:read permission may download.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "documents", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { filename } = await params

  // Sanitize: strip any path traversal attempts, keep only the basename.
  const safe = path.basename(decodeURIComponent(filename))
  if (!safe || safe !== filename.replace(/^[^/]+\//, "")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  // Only allow filenames that match our upload naming convention:
  // <uuid>-<safename>.<ext>  (UUID is 36 chars)
  if (!/^[0-9a-f-]{36}-.+\.[a-z0-9]+$/i.test(safe)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), "private-uploads")
  const filePath = path.join(uploadDir, safe)

  // Ensure the resolved path is inside the upload directory (defense-in-depth).
  if (!filePath.startsWith(uploadDir + path.sep)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  try {
    const data = await fs.readFile(filePath)
    const ext = path.extname(safe).toLowerCase()
    const mimeMap: Record<string, string> = {
      ".pdf":  "application/pdf",
      ".jpg":  "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png":  "image/png",
      ".gif":  "image/gif",
      ".webp": "image/webp",
      ".bmp":  "image/bmp",
      ".dcm":  "application/dicom",
      ".dicom":"application/dicom",
      ".zip":  "application/zip",
      ".csv":  "text/csv",
      ".txt":  "text/plain",
      ".xls":  "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    const contentType = mimeMap[ext] ?? "application/octet-stream"
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safe}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
