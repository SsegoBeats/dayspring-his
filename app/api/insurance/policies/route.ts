import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

const Create = z.object({
  patientId: z.string().uuid(),
  payerId: z.string().uuid(),
  policyNo: z.string().min(2).max(100),
  coverageNotes: z.string().optional().nullable(),
})

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth || !can(auth.role, "insurance", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT pol.id, pol.patient_id, pol.policy_no, pol.coverage_notes, pol.active, pol.updated_at,
            pay.id as payer_id, pay.name as payer_name, pay.payer_code
       FROM insurance_policies pol
       JOIN insurance_payers pay ON pay.id = pol.payer_id
      WHERE ($1::uuid IS NULL OR pol.patient_id = $1)
      ORDER BY pay.name ASC`,
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
  const data = Create.parse(await req.json())
  const { rows } = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `INSERT INTO insurance_policies (patient_id, payer_id, policy_no, coverage_notes)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [data.patientId, data.payerId, data.policyNo, data.coverageNotes || null]
  )
  await writeAuditLog({
    userId: auth.userId,
    action: "INSURANCE_POLICY_CREATE",
    entityType: "InsurancePolicy",
    entityId: rows[0].id,
    details: { patientId: data.patientId, payerId: data.payerId, policyNo: data.policyNo },
  })
  return NextResponse.json({ id: rows[0].id })
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "insurance", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const Update = z.object({ active: z.boolean().optional(), coverageNotes: z.string().optional().nullable() })
  const data = Update.parse(await req.json())
  await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `UPDATE insurance_policies SET active = COALESCE($1, active), coverage_notes = COALESCE($2, coverage_notes), updated_at = NOW() WHERE id = $3`,
    [data.active ?? null, data.coverageNotes ?? null, id]
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
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const { rows } = await queryWithSession<{ id: string, patient_id: string, payer_id: string, policy_no: string }>(
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
