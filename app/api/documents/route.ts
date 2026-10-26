import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { PATIENT_DOCUMENT_TYPES } from "@/lib/insurance"

type AuthContext = { role: string; userId: string }

// Accept absolute URLs (https://...) or app-relative paths like /uploads/...
const Create = z.object({
  patientId: z.string().uuid(),
  type: z.enum(PATIENT_DOCUMENT_TYPES),
  fileUrl: z.string().min(1),
  notes: z.string().optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(255).optional(),
})

declare global {
  var __dayspringDocumentColumnsPromise: Promise<void> | null | undefined
}

async function ensureDocumentColumns() {
  if (!globalThis.__dayspringDocumentColumnsPromise) {
    globalThis.__dayspringDocumentColumnsPromise = (async () => {
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
      try {
        await query(`ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check`)
      } catch {
        // Non-fatal; best effort only.
      }
      try {
        await query(
          `ALTER TABLE documents
             ADD CONSTRAINT documents_type_check
             CHECK (type IN ('ID','INSURANCE','GUARANTEE','REFERRAL','PREAUTH','CLAIM_FORM','CONSENT','OTHER'))`
        )
      } catch {
        // Non-fatal; compatible schema may already exist.
      }
    })().catch((error) => {
      globalThis.__dayspringDocumentColumnsPromise = null
      throw error
    })
  }

  await globalThis.__dayspringDocumentColumnsPromise
}

async function getUserFacilityId(auth: AuthContext): Promise<string | null> {
  if (auth.role === "Hospital Admin") return null
  const { rows } = await queryWithSession<{ facility_id?: string }>(
    { role: auth.role, userId: auth.userId },
    `SELECT facility_id FROM users WHERE id = $1 LIMIT 1`,
    [auth.userId],
  )
  return rows[0]?.facility_id ? String(rows[0].facility_id) : null
}

async function canAccessPatientByFacility(auth: AuthContext, patientId: string) {
  if (auth.role === "Hospital Admin") return true
  const facilityId = await getUserFacilityId(auth)
  if (!facilityId) return true
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT 1 FROM patients WHERE id = $1 AND facility_id::text = $2 LIMIT 1`,
    [patientId, facilityId],
  )
  return rows.length > 0
}

async function canAccessDocumentByFacility(auth: AuthContext, documentId: string) {
  if (auth.role === "Hospital Admin") return true
  const facilityId = await getUserFacilityId(auth)
  if (!facilityId) return true
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT 1
       FROM documents d
       JOIN patients p ON p.id = d.patient_id
      WHERE d.id = $1 AND p.facility_id::text = $2
      LIMIT 1`,
    [documentId, facilityId],
  )
  return rows.length > 0
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "documents", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureDocumentColumns()
  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const facilityId = await getUserFacilityId({ role: auth.role, userId: auth.userId })
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT d.id, d.patient_id, d.type, d.file_url, d.uploaded_by, d.uploaded_at, d.notes, d.original_name, d.mime_type
       FROM documents d
       JOIN patients p ON p.id = d.patient_id
      WHERE ($1::uuid IS NULL OR d.patient_id = $1)
        AND ($2::text IS NULL OR p.facility_id::text = $2)
      ORDER BY d.uploaded_at DESC`,
    [patientId, facilityId]
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
  if (!(await canAccessPatientByFacility({ role: auth.role, userId: auth.userId }, data.patientId))) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 })
  }
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
  if (!(await canAccessDocumentByFacility({ role: auth.role, userId: auth.userId }, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
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
