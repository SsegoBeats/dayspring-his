import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"
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

// ─── Magic-byte signatures ────────────────────────────────────────────────────
// Each entry: { offset, bytes } — the file must contain these bytes at the
// given byte offset for the MIME type to be considered authentic.
const MAGIC_SIGNATURES: Record<string, Array<{ offset: number; bytes: number[] }>> = {
  "image/jpeg":    [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  "image/png":     [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/gif":     [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  "image/webp":    [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF header
  "image/bmp":     [{ offset: 0, bytes: [0x42, 0x4d] }],
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  "application/dicom":      [{ offset: 128, bytes: [0x44, 0x49, 0x43, 0x4d] }], // DICM
  "application/dicom+json": [{ offset: 128, bytes: [0x44, 0x49, 0x43, 0x4d] }],
  "application/zip":             [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  "application/x-zip-compressed":[{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  // Excel (OOXML is a ZIP) and OLE2 compound documents
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  ],
  "application/vnd.ms-excel": [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE2
  ],
  // CSV and plain text have no reliable magic bytes — extension check suffices.
  "text/plain": [],
  "text/csv":   [],
}

/**
 * Returns true when the first `needed` bytes of `buf` match the signature
 * at the given offset, or when the MIME type has no known magic bytes
 * (CSV, plain text).
 */
function matchesMagic(buf: Buffer, mimeType: string): boolean {
  const sigs = MAGIC_SIGNATURES[mimeType]
  if (!sigs) return false         // unknown MIME — reject
  if (sigs.length === 0) return true // no magic bytes defined — accept on extension alone

  return sigs.some(({ offset, bytes }) => {
    if (buf.length < offset + bytes.length) return false
    return bytes.every((b, i) => buf[offset + i] === b)
  })
}

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

    // ── Size guard first (fast reject before reading bytes) ──────────────────
    const maxBytes = 25 * 1024 * 1024 // 25 MB
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 })
    }

    const ct = String((file as any).type || "").toLowerCase()
    const ext = path.extname(file.name || "").toLowerCase()
    const documentUpload = INSURANCE_UPLOAD_KINDS.has(kind)
    const allowedMimeTypes = documentUpload
      ? (LAB_UPLOAD_MIME_TYPES as unknown as string[])
      : (RADIOLOGY_UPLOAD_MIME_TYPES as unknown as string[])
    const allowedExtensions = documentUpload
      ? (LAB_UPLOAD_EXTENSIONS as unknown as string[])
      : (RADIOLOGY_UPLOAD_EXTENSIONS as unknown as string[])

    // ── Step 1: extension must be in allowlist ────────────────────────────────
    const hasAllowedExtension = allowedExtensions.includes(ext)

    // ── Step 2: MIME type from Content-Type must be in allowlist ─────────────
    // Images are allowed for all upload kinds (lab scans, radiology images, etc.)
    const isImage = ct.startsWith("image/")
    const hasAllowedMime = isImage || allowedMimeTypes.includes(ct)

    // Both must pass — prevents extension-only bypass or MIME-only bypass.
    if (!hasAllowedExtension || !hasAllowedMime) {
      const kindError =
        kind === "insurance"
          ? "Only insurance-safe uploads are allowed (images, PDF, TXT, CSV, or Excel)."
          : kind === "lab"
            ? "Only lab-safe uploads are allowed (images, PDF, TXT, CSV, or Excel)."
            : "Only imaging-related uploads are allowed (images, PDF, DICOM, or ZIP)."
      return NextResponse.json({ error: kindError }, { status: 415 })
    }

    // ── Step 3: magic-byte validation against actual file content ────────────
    const buffer = Buffer.from(await file.arrayBuffer())

    // For image/* types, derive the canonical MIME from magic bytes.
    let resolvedMime = ct
    if (isImage) {
      // Map extension to the expected MIME for image types not in MAGIC_SIGNATURES keys.
      const extMime: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",  ".gif": "image/gif",
        ".webp": "image/webp", ".bmp": "image/bmp",
      }
      resolvedMime = extMime[ext] ?? ct
    }

    if (!matchesMagic(buffer, resolvedMime)) {
      return NextResponse.json(
        { error: "File content does not match the declared type." },
        { status: 415 },
      )
    }

    // ── Build a cryptographically random, path-safe filename ─────────────────
    const uid = crypto.randomUUID()
    const safeBase = toSafeBase(file.name || "upload", ext)
    const filename = `${uid}-${safeBase}${ext}`

    // ── In production, prefer Vercel Blob ────────────────────────────────────
    const shouldUseBlob = INSURANCE_UPLOAD_KINDS.has(kind) && process.env.NODE_ENV === "production"
    if (shouldUseBlob) {
      try {
        const blob = await put(`uploads/${uid}/${safeBase}${ext}`, buffer, {
          access: "public",
          contentType: resolvedMime || undefined,
          addRandomSuffix: false,
        })
        return NextResponse.json({
          url: blob.url,
          mimeType: resolvedMime || null,
          originalName: file.name || filename,
          storage: "blob",
        })
      } catch (err: any) {
        console.error("[upload] Blob upload failed:", err?.message)
        const msg = process.env.NODE_ENV === "production" ? "Upload failed" : (err?.message || "Upload failed")
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }

    // ── Local filesystem fallback (dev/self-host) ─────────────────────────────
    // Files are stored OUTSIDE public/ so they are NOT statically served.
    // Access them through the authenticated /api/files/[filename] route instead.
    const uploadDir = path.join(process.cwd(), "private-uploads")
    await fs.mkdir(uploadDir, { recursive: true })
    const dest = path.join(uploadDir, filename)
    await fs.writeFile(dest, buffer)

    // Return the API-served URL (requires auth), NOT a static /uploads/ path.
    const url = `/api/files/${encodeURIComponent(filename)}`
    return NextResponse.json({ url, mimeType: resolvedMime || null, originalName: file.name || filename, storage: "local" })
  } catch (err: any) {
    console.error("[upload] Upload error:", err?.message)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
