import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { promises as fs } from "fs"
import path from "path"
import { RADIOLOGY_UPLOAD_EXTENSIONS, RADIOLOGY_UPLOAD_MIME_TYPES } from "@/lib/radiology"
import { put } from "@vercel/blob"

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

function toSafeBase(name: string, ext: string) {
  return (
    path
      .basename(name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 50) || "upload"
  )
}

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
    const hasAllowedMime = isImage || (allowedMimeTypes as unknown as string[]).includes(ct)
    const hasAllowedExtension = (allowedExtensions as unknown as string[]).includes(ext)
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

    const safeExt = ext || ""
    const safeBase = toSafeBase(file.name || "upload", safeExt)
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${safeExt}`

    // In production, prefer Vercel Blob for durability.
    // Requires BLOB_READ_WRITE_TOKEN (or Vercel project Blob integration).
    const shouldUseBlob = INSURANCE_UPLOAD_KINDS.has(kind) && process.env.NODE_ENV === "production"
    if (shouldUseBlob) {
      try {
        const blob = await put(
          `insurance/${filename}`,
          file,
          {
            access: "public",
            contentType: ct || undefined,
            addRandomSuffix: false,
          },
        )
        return NextResponse.json({
          url: blob.url,
          mimeType: ct || null,
          originalName: file.name || filename,
          storage: "blob",
        })
      } catch (err: any) {
        // If blob is not configured, fall back to local for non-production/dev-like setups.
        // Keep error opaque in production.
        const msg = process.env.NODE_ENV === "production" ? "Upload failed" : (err?.message || "Upload failed")
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }

    // Local filesystem fallback (dev/self-host). Not durable on Vercel serverless.
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadDir, { recursive: true })
    const dest = path.join(uploadDir, filename)
    await fs.writeFile(dest, buffer)
    const url = `/uploads/${filename}`
    return NextResponse.json({ url, mimeType: ct || null, originalName: file.name || filename, storage: "local" })
  } catch (err: any) {
    // Some runtimes throw TypeError for non-multipart bodies
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 })
  }
}
