import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { INSURANCE_PREAUTH_SERVICE_CATEGORIES, INSURANCE_PREAUTH_STATUSES } from "@/lib/insurance"

const nullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }, z.string().max(max).nullable().optional())

const nullableDate = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional())

const Create = z.object({
  patientId: z.string().uuid(),
  payerId: z.string().uuid(),
  policyId: z.string().uuid().nullable().optional(),
  serviceCategory: z.enum(INSURANCE_PREAUTH_SERVICE_CATEGORIES),
  requestedService: z.string().trim().min(2).max(500),
  requestReference: nullableTrimmedString(100),
  authCode: nullableTrimmedString(100),
  status: z.enum(INSURANCE_PREAUTH_STATUSES).default("Pending"),
  responseDueAt: nullableDate,
  validUntil: nullableDate,
  notes: nullableTrimmedString(1000),
})

const Update = z.object({
  payerId: z.string().uuid().optional(),
  policyId: z.string().uuid().nullable().optional(),
  serviceCategory: z.enum(INSURANCE_PREAUTH_SERVICE_CATEGORIES).optional(),
  requestedService: z.string().trim().min(2).max(500).optional(),
  requestReference: nullableTrimmedString(100),
  authCode: nullableTrimmedString(100),
  status: z.enum(INSURANCE_PREAUTH_STATUSES).optional(),
  responseDueAt: nullableDate,
  validUntil: nullableDate,
  notes: nullableTrimmedString(1000),
})

declare global {
  var __dayspringPreauthColumnsPromise: Promise<void> | null | undefined
}

async function ensurePreauthorizationColumns() {
  if (!globalThis.__dayspringPreauthColumnsPromise) {
    globalThis.__dayspringPreauthColumnsPromise = (async () => {
      const statements = [
        `ALTER TABLE preauthorizations ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES insurance_policies(id) ON DELETE SET NULL`,
        `ALTER TABLE preauthorizations ADD COLUMN IF NOT EXISTS service_category VARCHAR(50) DEFAULT 'Other'`,
        `ALTER TABLE preauthorizations ADD COLUMN IF NOT EXISTS requested_service TEXT`,
        `ALTER TABLE preauthorizations ADD COLUMN IF NOT EXISTS request_reference VARCHAR(100)`,
        `ALTER TABLE preauthorizations ADD COLUMN IF NOT EXISTS response_due_at DATE`,
        `ALTER TABLE preauthorizations ADD COLUMN IF NOT EXISTS valid_until DATE`,
        `CREATE INDEX IF NOT EXISTS idx_preauth_policy ON preauthorizations(policy_id)`,
      ]

      for (const statement of statements) {
        try {
          await query(statement)
        } catch {
          // Non-fatal. Main queries surface actual issues.
        }
      }

      try {
        await query(`ALTER TABLE preauthorizations DROP CONSTRAINT IF EXISTS preauthorizations_status_check`)
      } catch {}
      try {
        await query(
          `ALTER TABLE preauthorizations
             ADD CONSTRAINT preauthorizations_status_check
             CHECK (status IN ('Pending','Approved','Denied','Expired'))`
        )
      } catch {}
    })().catch((error) => {
      globalThis.__dayspringPreauthColumnsPromise = null
      throw error
    })
  }

  await globalThis.__dayspringPreauthColumnsPromise
}

function validateDates(responseDueAt?: string | null, validUntil?: string | null) {
  if (responseDueAt && validUntil && new Date(validUntil).getTime() < new Date(responseDueAt).getTime()) {
    return "Authorization validity cannot end before the expected response date"
  }
  return null
}

function validateAuthorizationWorkflow({
  status,
  authCode,
  requestReference,
  notes,
}: {
  status?: string | null
  authCode?: string | null
  requestReference?: string | null
  notes?: string | null
}) {
  if (status === "Approved" && !authCode && !requestReference) {
    return "Approved authorizations need an authorization code or request reference"
  }
  if (status === "Denied" && !notes) {
    return "Denied authorizations should include notes explaining the outcome"
  }
  return null
}

async function requireAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (!auth || !can(auth.role, "insurance", "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensurePreauthorizationColumns()

  const url = new URL(req.url)
  const patientId = url.searchParams.get("patientId")
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT
        pa.id,
        pa.patient_id,
        pa.appointment_id,
        pa.payer_id,
        pa.policy_id,
        pa.status,
        pa.auth_code,
        pa.request_reference,
        pa.service_category,
        pa.requested_service,
        pa.response_due_at,
        pa.valid_until,
        pa.notes,
        pa.created_at,
        pa.updated_at,
        pay.name AS payer_name,
        pol.policy_no
      FROM preauthorizations pa
      JOIN insurance_payers pay ON pay.id = pa.payer_id
      LEFT JOIN insurance_policies pol ON pol.id = pa.policy_id
      WHERE ($1::uuid IS NULL OR pa.patient_id = $1)
      ORDER BY
        CASE pa.status
          WHEN 'Pending' THEN 1
          WHEN 'Approved' THEN 2
          WHEN 'Denied' THEN 3
          WHEN 'Expired' THEN 4
          ELSE 9
        END,
        pa.updated_at DESC,
        pa.created_at DESC`,
    [patientId],
  )

  return NextResponse.json({ preauthorizations: rows })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensurePreauthorizationColumns()

  const data = Create.parse(await req.json())
  const dateError = validateDates(data.responseDueAt ?? null, data.validUntil ?? null)
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 })
  const workflowError = validateAuthorizationWorkflow(data)
  if (workflowError) return NextResponse.json({ error: workflowError }, { status: 400 })

  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO preauthorizations (
        patient_id,
        payer_id,
        policy_id,
        status,
        auth_code,
        notes,
        service_category,
        requested_service,
        request_reference,
        response_due_at,
        valid_until
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
    [
      data.patientId,
      data.payerId,
      data.policyId ?? null,
      data.status,
      data.authCode ?? null,
      data.notes ?? null,
      data.serviceCategory,
      data.requestedService,
      data.requestReference ?? null,
      data.responseDueAt ?? null,
      data.validUntil ?? null,
    ],
  )

  await writeAuditLog({
    userId: auth.userId,
    action: "PREAUTH_CREATE",
    entityType: "Preauthorization",
    entityId: rows[0].id,
    details: data,
  })

  return NextResponse.json({ id: rows[0].id })
}

export async function PATCH(req: Request) {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensurePreauthorizationColumns()

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const data = Update.parse(await req.json())
  const {
    rows: existingRows,
  } = await queryWithSession<{
    status: string | null
    auth_code: string | null
    request_reference: string | null
    response_due_at: string | null
    valid_until: string | null
    notes: string | null
  }>(
    { role: auth.role, userId: auth.userId },
    `SELECT status, auth_code, request_reference, response_due_at, valid_until, notes
       FROM preauthorizations
      WHERE id = $1`,
    [id],
  )
  const existing = existingRows[0]
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const nextStatus = data.status ?? existing.status
  const nextAuthCode = Object.prototype.hasOwnProperty.call(data, "authCode") ? data.authCode ?? null : existing.auth_code
  const nextRequestReference = Object.prototype.hasOwnProperty.call(data, "requestReference")
    ? data.requestReference ?? null
    : existing.request_reference
  const nextNotes = Object.prototype.hasOwnProperty.call(data, "notes") ? data.notes ?? null : existing.notes
  const nextResponseDueAt = Object.prototype.hasOwnProperty.call(data, "responseDueAt")
    ? data.responseDueAt ?? null
    : existing.response_due_at
  const nextValidUntil = Object.prototype.hasOwnProperty.call(data, "validUntil")
    ? data.validUntil ?? null
    : existing.valid_until

  const dateError = validateDates(nextResponseDueAt, nextValidUntil)
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 })
  const workflowError = validateAuthorizationWorkflow({
    status: nextStatus,
    authCode: nextAuthCode,
    requestReference: nextRequestReference,
    notes: nextNotes,
  })
  if (workflowError) return NextResponse.json({ error: workflowError }, { status: 400 })

  const fields: string[] = []
  const values: unknown[] = []
  const pushField = (column: string, value: unknown) => {
    values.push(value)
    fields.push(`${column} = $${values.length}`)
  }

  if (data.payerId !== undefined) pushField("payer_id", data.payerId)
  if (data.policyId !== undefined) pushField("policy_id", data.policyId ?? null)
  if (data.serviceCategory !== undefined) pushField("service_category", data.serviceCategory)
  if (data.requestedService !== undefined) pushField("requested_service", data.requestedService)
  if (Object.prototype.hasOwnProperty.call(data, "requestReference")) pushField("request_reference", data.requestReference ?? null)
  if (Object.prototype.hasOwnProperty.call(data, "authCode")) pushField("auth_code", data.authCode ?? null)
  if (data.status !== undefined) pushField("status", data.status)
  if (Object.prototype.hasOwnProperty.call(data, "responseDueAt")) pushField("response_due_at", data.responseDueAt ?? null)
  if (Object.prototype.hasOwnProperty.call(data, "validUntil")) pushField("valid_until", data.validUntil ?? null)
  if (Object.prototype.hasOwnProperty.call(data, "notes")) pushField("notes", data.notes ?? null)

  if (!fields.length) {
    return NextResponse.json({ error: "No changes supplied" }, { status: 400 })
  }

  fields.push("updated_at = NOW()")
  values.push(id)

  await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `UPDATE preauthorizations SET ${fields.join(", ")} WHERE id = $${values.length}`,
    values,
  )

  await writeAuditLog({
    userId: auth.userId,
    action: "PREAUTH_UPDATE",
    entityType: "Preauthorization",
    entityId: id,
    details: data,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `DELETE FROM preauthorizations WHERE id = $1 RETURNING id, patient_id, payer_id, policy_id`,
    [id],
  )
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await writeAuditLog({
    userId: auth.userId,
    action: "PREAUTH_DELETE",
    entityType: "Preauthorization",
    entityId: id,
    details: rows[0],
  })

  return NextResponse.json({ success: true })
}
