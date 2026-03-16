import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import {
  INSURANCE_SUBSCRIBER_RELATIONSHIPS,
  INSURANCE_VERIFICATION_STATUSES,
} from "@/lib/insurance"

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
  policyNo: z.string().trim().min(2).max(100),
  memberId: nullableTrimmedString(100),
  groupNo: nullableTrimmedString(100),
  planName: nullableTrimmedString(150),
  subscriberName: nullableTrimmedString(150),
  subscriberRelationship: z.enum(INSURANCE_SUBSCRIBER_RELATIONSHIPS).nullable().optional(),
  coordinationOrder: z.number().int().min(1).max(9).default(1),
  effectiveDate: nullableDate,
  expiryDate: nullableDate,
  verificationStatus: z.enum(INSURANCE_VERIFICATION_STATUSES).default("Unverified"),
  verificationReference: nullableTrimmedString(100),
  verificationNotes: nullableTrimmedString(1000),
  authorizationRequired: z.boolean().default(false),
  authorizationReference: nullableTrimmedString(100),
  coverageNotes: nullableTrimmedString(1000),
  active: z.boolean().default(true),
})

const Update = z.object({
  payerId: z.string().uuid().optional(),
  policyNo: z.string().trim().min(2).max(100).optional(),
  memberId: nullableTrimmedString(100),
  groupNo: nullableTrimmedString(100),
  planName: nullableTrimmedString(150),
  subscriberName: nullableTrimmedString(150),
  subscriberRelationship: z.enum(INSURANCE_SUBSCRIBER_RELATIONSHIPS).nullable().optional(),
  coordinationOrder: z.number().int().min(1).max(9).optional(),
  effectiveDate: nullableDate,
  expiryDate: nullableDate,
  verificationStatus: z.enum(INSURANCE_VERIFICATION_STATUSES).optional(),
  verificationReference: nullableTrimmedString(100),
  verificationNotes: nullableTrimmedString(1000),
  authorizationRequired: z.boolean().optional(),
  authorizationReference: nullableTrimmedString(100),
  coverageNotes: nullableTrimmedString(1000),
  active: z.boolean().optional(),
})

declare global {
  var __dayspringInsuranceColumnsPromise: Promise<void> | null | undefined
}

async function ensureInsuranceColumns() {
  if (!globalThis.__dayspringInsuranceColumnsPromise) {
    globalThis.__dayspringInsuranceColumnsPromise = (async () => {
      const statements = [
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS member_id VARCHAR(100)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS group_no VARCHAR(100)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS plan_name VARCHAR(150)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS subscriber_name VARCHAR(150)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS subscriber_relationship VARCHAR(30)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS coordination_order INTEGER DEFAULT 1`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS effective_date DATE`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS expiry_date DATE`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'Unverified'`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS verification_reference VARCHAR(100)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS verification_notes TEXT`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS authorization_required BOOLEAN DEFAULT false`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS authorization_reference VARCHAR(100)`,
      ]

      for (const statement of statements) {
        try {
          await query(statement)
        } catch {
          // Non-fatal. Subsequent queries will surface actual schema issues.
        }
      }
    })().catch((error) => {
      globalThis.__dayspringInsuranceColumnsPromise = null
      throw error
    })
  }

  await globalThis.__dayspringInsuranceColumnsPromise
}

function hasOwnProperty<T extends object, K extends PropertyKey>(value: T, key: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "insurance", "read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureInsuranceColumns()

  const url = new URL(req.url)
  const patientId = url.searchParams.get("patientId")
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT pol.id,
            pol.patient_id,
            pol.policy_no,
            pol.member_id,
            pol.group_no,
            pol.plan_name,
            pol.subscriber_name,
            pol.subscriber_relationship,
            pol.coordination_order,
            pol.effective_date,
            pol.expiry_date,
            pol.coverage_notes,
            pol.verification_status,
            pol.verification_reference,
            pol.verification_notes,
            pol.verified_at,
            pol.authorization_required,
            pol.authorization_reference,
            pol.active,
            pol.updated_at,
            pay.id AS payer_id,
            pay.name AS payer_name,
            pay.payer_code
       FROM insurance_policies pol
       JOIN insurance_payers pay ON pay.id = pol.payer_id
      WHERE ($1::uuid IS NULL OR pol.patient_id = $1)
      ORDER BY COALESCE(pol.coordination_order, 1) ASC, pol.active DESC, pay.name ASC`,
    [patientId]
  )
  return NextResponse.json({ policies: rows })
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureInsuranceColumns()

  const data = Create.parse(await req.json())
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO insurance_policies (
        patient_id,
        payer_id,
        policy_no,
        member_id,
        group_no,
        plan_name,
        subscriber_name,
        subscriber_relationship,
        coordination_order,
        effective_date,
        expiry_date,
        coverage_notes,
        verification_status,
        verification_reference,
        verification_notes,
        verified_at,
        authorization_required,
        authorization_reference,
        active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id`,
    [
      data.patientId,
      data.payerId,
      data.policyNo,
      data.memberId ?? null,
      data.groupNo ?? null,
      data.planName ?? null,
      data.subscriberName ?? null,
      data.subscriberRelationship ?? null,
      data.coordinationOrder,
      data.effectiveDate ?? null,
      data.expiryDate ?? null,
      data.coverageNotes ?? null,
      data.verificationStatus,
      data.verificationReference ?? null,
      data.verificationNotes ?? null,
      data.verificationStatus === "Verified" ? new Date().toISOString() : null,
      data.authorizationRequired,
      data.authorizationReference ?? null,
      data.active,
    ]
  )
  await writeAuditLog({
    userId: auth.userId,
    action: "INSURANCE_POLICY_CREATE",
    entityType: "InsurancePolicy",
    entityId: rows[0].id,
    details: data,
  })
  return NextResponse.json({ id: rows[0].id })
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureInsuranceColumns()

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const data = Update.parse(await req.json())
  const fields: string[] = []
  const values: unknown[] = []

  const pushField = (column: string, value: unknown) => {
    values.push(value)
    fields.push(`${column} = $${values.length}`)
  }

  if (data.payerId !== undefined) pushField("payer_id", data.payerId)
  if (data.policyNo !== undefined) pushField("policy_no", data.policyNo)
  if (hasOwnProperty(data, "memberId")) pushField("member_id", data.memberId ?? null)
  if (hasOwnProperty(data, "groupNo")) pushField("group_no", data.groupNo ?? null)
  if (hasOwnProperty(data, "planName")) pushField("plan_name", data.planName ?? null)
  if (hasOwnProperty(data, "subscriberName")) pushField("subscriber_name", data.subscriberName ?? null)
  if (hasOwnProperty(data, "subscriberRelationship")) {
    pushField("subscriber_relationship", data.subscriberRelationship ?? null)
  }
  if (data.coordinationOrder !== undefined) pushField("coordination_order", data.coordinationOrder)
  if (hasOwnProperty(data, "effectiveDate")) pushField("effective_date", data.effectiveDate ?? null)
  if (hasOwnProperty(data, "expiryDate")) pushField("expiry_date", data.expiryDate ?? null)
  if (hasOwnProperty(data, "coverageNotes")) pushField("coverage_notes", data.coverageNotes ?? null)
  if (hasOwnProperty(data, "verificationReference")) {
    pushField("verification_reference", data.verificationReference ?? null)
  }
  if (hasOwnProperty(data, "verificationNotes")) pushField("verification_notes", data.verificationNotes ?? null)
  if (data.authorizationRequired !== undefined) {
    pushField("authorization_required", data.authorizationRequired)
  }
  if (hasOwnProperty(data, "authorizationReference")) {
    pushField("authorization_reference", data.authorizationReference ?? null)
  }
  if (data.active !== undefined) pushField("active", data.active)

  if (data.verificationStatus !== undefined) {
    values.push(data.verificationStatus)
    const statusPosition = values.length
    fields.push(`verification_status = $${statusPosition}`)
    fields.push(
      `verified_at = CASE WHEN $${statusPosition} = 'Verified' THEN COALESCE(verified_at, NOW()) ELSE NULL END`
    )
  }

  if (!fields.length) {
    return NextResponse.json({ error: "No changes supplied" }, { status: 400 })
  }

  fields.push("updated_at = NOW()")
  values.push(id)

  await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `UPDATE insurance_policies
        SET ${fields.join(", ")}
      WHERE id = $${values.length}`,
    values
  )
  await writeAuditLog({
    userId: auth.userId,
    action: "INSURANCE_POLICY_UPDATE",
    entityType: "InsurancePolicy",
    entityId: id,
    details: data,
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { rows } = await queryWithSession<{ id: string; patient_id: string; payer_id: string; policy_no: string }>(
    { role: auth.role, userId: auth.userId },
    `DELETE FROM insurance_policies WHERE id = $1 RETURNING id, patient_id, payer_id, policy_no`,
    [id]
  )
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await writeAuditLog({
    userId: auth.userId,
    action: "INSURANCE_POLICY_DELETE",
    entityType: "InsurancePolicy",
    entityId: id,
    details: rows[0],
  })
  return NextResponse.json({ success: true })
}
