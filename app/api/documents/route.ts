import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

// Accept absolute URLs (https://...) or app-relative paths like /uploads/...
const Create = z.object({
  patientId: z.string().uuid(),
  type: z.enum(['ID','INSURANCE','CONSENT','OTHER']),
  fileUrl: z.string().min(1),
  notes: z.string().optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(255).optional(),
})

async function ensureDocumentColumns() {
  try {
    await query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT`)
  } catch {
    // Non-fatal; main queries will surface genuine schema issues.
  }
  try {
    await query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_name TEXT`)
  } catch {
    // Non-fatal; main queries will surface genuine schema issues.
  }
  try {
    await query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT`)
  } catch {
    // Non-fatal; main queries will surface genuine schema issues.
  }
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "documents", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureDocumentColumns()
  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT id, patient_id, type, file_url, uploaded_by, uploaded_at, notes, original_name, mime_type FROM documents
      WHERE ($1::uuid IS NULL OR patient_id = $1)
      ORDER BY uploaded_at DESC`,
    [patientId]
  )
  return NextResponse.json({ documents: rows })
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "documents", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureDocumentColumns()
  const data = Create.parse(await req.json())
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO documents (patient_id, type, file_url, uploaded_by, notes, original_name, mime_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [data.patientId, data.type, data.fileUrl, auth.userId, data.notes || null, data.fileName || null, data.mimeType || null]
  )
  await writeAuditLog({
    userId: auth.userId,
    action: "DOCUMENT_UPLOAD",
    entityType: "Document",
    entityId: rows[0].id,
    details: {
      patientId: data.patientId,
      type: data.type,
      fileUrl: data.fileUrl,
      notes: data.notes || null,
      fileName: data.fileName || null,
      mimeType: data.mimeType || null,
    },
  })
  return NextResponse.json({ id: rows[0].id })
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "documents", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const { rows } = await queryWithSession<{ id: string; patient_id: string; type: string }>(
    { role: auth.role, userId: auth.userId },
    `DELETE FROM documents WHERE id = $1 RETURNING id, patient_id, type`,
    [id]
  )
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await writeAuditLog({
    userId: auth.userId,
    action: "DOCUMENT_DELETE",
    entityType: "Document",
    entityId: id,
    details: rows[0],
  })
  return NextResponse.json({ success: true })
}
