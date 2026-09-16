import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import {
  INSURANCE_PANEL_STATUSES,
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
  schemeName: nullableTrimmedString(150),
  employerName: nullableTrimmedString(150),
  staffNumber: nullableTrimmedString(100),
  subscriberName: nullableTrimmedString(150),
  subscriberRelationship: z.enum(INSURANCE_SUBSCRIBER_RELATIONSHIPS).nullable().optional(),
  coordinationOrder: z.number().int().min(1).max(9).default(1),
  panelStatus: z.enum(INSURANCE_PANEL_STATUSES).default("Unknown"),
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
  schemeName: nullableTrimmedString(150),
  employerName: nullableTrimmedString(150),
  staffNumber: nullableTrimmedString(100),
  subscriberName: nullableTrimmedString(150),
  subscriberRelationship: z.enum(INSURANCE_SUBSCRIBER_RELATIONSHIPS).nullable().optional(),
  coordinationOrder: z.number().int().min(1).max(9).optional(),
  panelStatus: z.enum(INSURANCE_PANEL_STATUSES).optional(),
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
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS scheme_name VARCHAR(150)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS employer_name VARCHAR(150)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS staff_number VARCHAR(100)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS subscriber_name VARCHAR(150)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS subscriber_relationship VARCHAR(30)`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS coordination_order INTEGER DEFAULT 1`,
        `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS panel_status VARCHAR(30) DEFAULT 'Unknown'`,
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
          // Non-fatal. Main queries surface actual issues.
        }
      }

      try {
        await query(`ALTER TABLE insurance_policies DROP CONSTRAINT IF EXISTS insurance_policies_panel_status_check`)
      } catch {}
      try {
        await query(
          `ALTER TABLE insurance_policies
             ADD CONSTRAINT insurance_policies_panel_status_check
             CHECK (panel_status IN ('Unknown','Confirmed','Limited Panel','Out of Panel'))`
        )
      } catch {}
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

function validateCoverageDates(effectiveDate?: string | null, expiryDate?: string | null) {
  if (!effectiveDate || !expiryDate) return null
  if (new Date(expiryDate).getTime() < new Date(effectiveDate).getTime()) {
    return "Expiry date cannot be earlier than effective date"
  }
  return null
}

function validateVerification(status?: string, reference?: string | null) {
  if (status === "Verified" && !reference) {
    return "Verification reference is required when cover is marked verified"
  }
  return null
}

async function resolvePayerType(
  auth: NonNullable<Awaited<ReturnType<typeof requireAuth>>>,
  payerId: string,
) {
  const { rows } = await queryWithSession<{ payer_type: string | null }>(
    { role: auth.role, userId: auth.userId },
    `SELECT payer_type FROM insurance_payers WHERE id = $1`,
    [payerId],
  )
  return rows[0]?.payer_type || null
}

async function validatePolicyWorkflow(
  auth: NonNullable<Awaited<ReturnType<typeof requireAuth>>>,
  payload: {
    payerId: string
    schemeName?: string | null
    employerName?: string | null
  },
) {
  const payerType = await resolvePayerType(auth, payload.payerId)
  if (payerType === "CORPORATE" && !payload.schemeName && !payload.employerName) {
    return "Corporate or sponsor cover should include an employer or scheme name"
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
            pol.scheme_name,
            pol.employer_name,
            pol.staff_number,
            pol.subscriber_name,
            pol.subscriber_relationship,
            pol.coordination_order,
            pol.panel_status,
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
            pay.payer_code,
            pay.payer_type,
            pay.requires_preauth_default,
            pay.scheme_stamp_required,
            pay.panel_driven,
            pay.contact_phone,
            pay.contact_email,
            pay.notes AS payer_notes
       FROM insurance_policies pol
       JOIN insurance_payers pay ON pay.id = pol.payer_id
      WHERE ($1::uuid IS NULL OR pol.patient_id = $1)
      ORDER BY COALESCE(pol.coordination_order, 1) ASC, pol.active DESC, pay.name ASC`,
    [patientId],
  )

  return NextResponse.json({ policies: rows })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureInsuranceColumns()

  const data = Create.parse(await req.json())
  const dateError = validateCoverageDates(data.effectiveDate, data.expiryDate)
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 })
  const verificationError = validateVerification(data.verificationStatus, data.verificationReference ?? null)
  if (verificationError) return NextResponse.json({ error: verificationError }, { status: 400 })
  const workflowError = await validatePolicyWorkflow(auth, data)
  if (workflowError) return NextResponse.json({ error: workflowError }, { status: 400 })

  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO insurance_policies (
        patient_id,
        payer_id,
        policy_no,
        member_id,
        group_no,
        plan_name,
        scheme_name,
        employer_name,
        staff_number,
        subscriber_name,
        subscriber_relationship,
        coordination_order,
        panel_status,
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING id`,
    [
      data.patientId,
      data.payerId,
      data.policyNo,
      data.memberId ?? null,
      data.groupNo ?? null,
      data.planName ?? null,
      data.schemeName ?? null,
      data.employerName ?? null,
      data.staffNumber ?? null,
      data.subscriberName ?? null,
      data.subscriberRelationship ?? null,
      data.coordinationOrder,
      data.panelStatus,
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
    ],
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
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureInsuranceColumns()

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const data = Update.parse(await req.json())
  const {
    rows: existingRows,
  } = await queryWithSession<{
    payer_id: string
    effective_date: string | null
    expiry_date: string | null
    verification_status: string | null
    verification_reference: string | null
    scheme_name: string | null
    employer_name: string | null
  }>(
    { role: auth.role, userId: auth.userId },
    `SELECT payer_id, effective_date, expiry_date, verification_status, verification_reference, scheme_name, employer_name
       FROM insurance_policies
      WHERE id = $1`,
    [id],
  )
  const existing = existingRows[0]
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const nextEffectiveDate = hasOwnProperty(data, "effectiveDate") ? data.effectiveDate ?? null : existing.effective_date
  const nextExpiryDate = hasOwnProperty(data, "expiryDate") ? data.expiryDate ?? null : existing.expiry_date
  const nextVerificationStatus = data.verificationStatus ?? existing.verification_status ?? "Unverified"
  const nextVerificationReference = hasOwnProperty(data, "verificationReference")
    ? data.verificationReference ?? null
    : existing.verification_reference
  const nextPayerId = data.payerId ?? existing.payer_id
  const nextSchemeName = hasOwnProperty(data, "schemeName") ? data.schemeName ?? null : existing.scheme_name
  const nextEmployerName = hasOwnProperty(data, "employerName") ? data.employerName ?? null : existing.employer_name

  const dateError = validateCoverageDates(nextEffectiveDate, nextExpiryDate)
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 })
  const verificationError = validateVerification(nextVerificationStatus, nextVerificationReference)
  if (verificationError) return NextResponse.json({ error: verificationError }, { status: 400 })
  const workflowError = await validatePolicyWorkflow(auth, {
    payerId: nextPayerId,
    schemeName: nextSchemeName,
    employerName: nextEmployerName,
  })
  if (workflowError) return NextResponse.json({ error: workflowError }, { status: 400 })

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
  if (hasOwnProperty(data, "schemeName")) pushField("scheme_name", data.schemeName ?? null)
  if (hasOwnProperty(data, "employerName")) pushField("employer_name", data.employerName ?? null)
  if (hasOwnProperty(data, "staffNumber")) pushField("staff_number", data.staffNumber ?? null)
  if (hasOwnProperty(data, "subscriberName")) pushField("subscriber_name", data.subscriberName ?? null)
  if (hasOwnProperty(data, "subscriberRelationship")) {
    pushField("subscriber_relationship", data.subscriberRelationship ?? null)
  }
  if (data.coordinationOrder !== undefined) pushField("coordination_order", data.coordinationOrder)
  if (data.panelStatus !== undefined) pushField("panel_status", data.panelStatus)
  if (hasOwnProperty(data, "effectiveDate")) pushField("effective_date", data.effectiveDate ?? null)
  if (hasOwnProperty(data, "expiryDate")) pushField("expiry_date", data.expiryDate ?? null)
  if (hasOwnProperty(data, "coverageNotes")) pushField("coverage_notes", data.coverageNotes ?? null)
  if (hasOwnProperty(data, "verificationReference")) {
    pushField("verification_reference", data.verificationReference ?? null)
  }
  if (hasOwnProperty(data, "verificationNotes")) pushField("verification_notes", data.verificationNotes ?? null)
  if (data.authorizationRequired !== undefined) pushField("authorization_required", data.authorizationRequired)
  if (hasOwnProperty(data, "authorizationReference")) {
    pushField("authorization_reference", data.authorizationReference ?? null)
  }
  if (data.active !== undefined) pushField("active", data.active)

  if (data.verificationStatus !== undefined) {
    values.push(data.verificationStatus)
    const statusPosition = values.length
    fields.push(`verification_status = $${statusPosition}`)
    fields.push(`verified_at = CASE WHEN $${statusPosition} = 'Verified' THEN COALESCE(verified_at, NOW()) ELSE NULL END`)
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
    values,
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
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { rows } = await queryWithSession<{ id: string; patient_id: string; payer_id: string; policy_no: string }>(
    { role: auth.role, userId: auth.userId },
    `DELETE FROM insurance_policies WHERE id = $1 RETURNING id, patient_id, payer_id, policy_no`,
    [id],
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
