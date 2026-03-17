import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { promises as fs } from "fs"
import path from "path"
import { RADIOLOGY_UPLOAD_EXTENSIONS, RADIOLOGY_UPLOAD_MIME_TYPES } from "@/lib/radiology"

export const runtime = "nodejs"

const LAB_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const

const LAB_UPLOAD_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".pdf",
  ".txt",
  ".csv",
  ".xls",
  ".xlsx",
] as const

const INSURANCE_UPLOAD_KINDS = new Set(["insurance", "lab"])

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "documents", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const kind = String(form.get("kind") || "radiology").toLowerCase()
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })
    const ct = String((file as any).type || "").toLowerCase()
    const ext = path.extname(file.name || "").toLowerCase()
    const isImage = ct.startsWith("image/")
    const documentUpload = INSURANCE_UPLOAD_KINDS.has(kind)
    const allowedMimeTypes = documentUpload ? LAB_UPLOAD_MIME_TYPES : RADIOLOGY_UPLOAD_MIME_TYPES
    const allowedExtensions = documentUpload ? LAB_UPLOAD_EXTENSIONS : RADIOLOGY_UPLOAD_EXTENSIONS
    const hasAllowedMime = isImage || allowedMimeTypes.includes(ct as (typeof allowedMimeTypes)[number])
    const hasAllowedExtension = allowedExtensions.includes(ext as (typeof allowedExtensions)[number])
    if (!(hasAllowedMime || hasAllowedExtension)) {
      const kindError =
        kind === "insurance"
          ? "Only insurance-safe uploads are allowed (images, PDF, TXT, CSV, or Excel)."
          : kind === "lab"
            ? "Only lab-safe uploads are allowed (images, PDF, TXT, CSV, or Excel)."
            : "Only imaging-related uploads are allowed (images, PDF, DICOM, or ZIP)."
      return NextResponse.json(
        { error: kindError },
        { status: 415 },
      )
    }

    // Basic size guard (25 MB) to allow PDFs and packaged imaging attachments.
    const maxBytes = 25 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const safeExt = ext || ""
    const safeBase = path
      .basename(file.name, safeExt)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 50)
      || "upload"
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${safeExt}`
    const uploadDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadDir, { recursive: true })
    const dest = path.join(uploadDir, filename)
    await fs.writeFile(dest, buffer)

    // Public URL path
    const url = `/uploads/${filename}`
    return NextResponse.json({ url, mimeType: ct || null, originalName: file.name || filename })
  } catch (err: any) {
    // Some runtimes throw TypeError for non-multipart bodies
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 })
  }
}
