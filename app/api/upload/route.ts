import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "documents", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })
    // Restrict to images only
    const ct = (file as any).type || ''
    if (!ct || !ct.startsWith('image/')) {
      return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 415 })
    }

    // Basic size guard (10 MB)
    const maxBytes = 10 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(file.name) || ""
    const safeBase = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 50)
      || "upload"
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${ext}`
    const uploadDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadDir, { recursive: true })
    const dest = path.join(uploadDir, filename)
    await fs.writeFile(dest, buffer)

    // Public URL path
    const url = `/uploads/${filename}`
    return NextResponse.json({ url })
  } catch (err: any) {
    // Some runtimes throw TypeError for non-multipart bodies
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 })
  }
}
