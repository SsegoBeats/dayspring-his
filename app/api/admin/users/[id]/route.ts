import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can, hashPassword } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

const UpdateSchema = z.object({
  // Only allow role and status updates for security
  role: z
    .enum([
      "Receptionist",
      "Doctor",
      "Radiologist",
      "Nurse",
      "Lab Tech",
      "Hospital Admin",
      "Cashier",
      "Pharmacist",
      "Midwife",
      "Dentist",
    ])
    .optional(),
  status: z.boolean().optional(),
})

export async function PUT(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "users", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await _.json()
  const input = UpdateSchema.parse(body)

  const fields: string[] = []
  const values: any[] = []
  let idx = 1
  
  // Only allow role and status updates for security
  if (input.role !== undefined) {
    fields.push(`role = $${idx++}`)
    values.push(input.role)
  }
  if (input.status !== undefined) {
    fields.push(`is_active = $${idx++}`)
    values.push(!!input.status)
  }
  if (fields.length === 0) return NextResponse.json({ success: true })
  values.push(id)
  await query(`UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx}`, values)
  await writeAuditLog({ action: "user_update", entityType: "user", entityId: id, userId: auth.userId, details: input })
  return NextResponse.json({ success: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "users", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    // Proactively null-out references in many tables so delete never fails
    const nullify: Array<[string,string]> = [
      ['audit_logs','user_id'],
      ['triage_assessments','recorded_by'],
      ['appointments','doctor_id'],
      ['appointments','created_by'],
      ['medical_records','doctor_id'],
      ['vital_signs','nurse_id'],
      ['nursing_notes','nurse_id'],
      ['prescriptions','doctor_id'],
      ['prescriptions','dispensed_by'],
      ['lab_tests','doctor_id'],
      ['lab_tests','lab_tech_id'],
      ['radiology_tests','doctor_id'],
      ['radiology_tests','radiologist_id'],
      ['bills','cashier_id'],
      ['payments','cashier_id'],
      ['patient_routing','routed_by'],
      ['bed_assignments','assigned_by'],
      ['checkins','receptionist_id'],
      ['documents','uploaded_by'],
      ['notifications','user_id'],
    ]
    for (const [tbl, col] of nullify) {
      try { await query(`UPDATE ${tbl} SET ${col} = NULL WHERE ${col} = $1`, [id]) } catch {}
    }
    // Tables we prefer to fully remove (in case FKs are RESTRICT): schedules/tokens
    try { await query(`DELETE FROM doctor_schedules WHERE doctor_id = $1`, [id]) } catch {}
    try { await query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [id]) } catch {}
    try { await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [id]) } catch {}

    await query(`DELETE FROM users WHERE id = $1`, [id])
    await writeAuditLog({ action: "user_delete", entityType: "user", entityId: id, userId: auth.userId })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const code = e?.code || ''
    if (code === '23503') {
      const constraint = e?.constraint || ''
      // Auto-remediate a common legacy constraint on checkins.receptionist_id
      if (constraint === 'checkins_receptionist_id_fkey') {
        try {
          await query(`ALTER TABLE checkins ALTER COLUMN receptionist_id DROP NOT NULL`)
        } catch {}
        try {
          await query(`ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_receptionist_id_fkey`)
          await query(`ALTER TABLE checkins ADD CONSTRAINT checkins_receptionist_id_fkey FOREIGN KEY (receptionist_id) REFERENCES users(id) ON DELETE SET NULL`)
        } catch {}
        try { await query(`UPDATE checkins SET receptionist_id = NULL WHERE receptionist_id = $1`, [id]) } catch {}
        // Retry delete once
        try {
          await query(`DELETE FROM users WHERE id = $1`, [id])
          await writeAuditLog({ action: "user_delete", entityType: "user", entityId: id, userId: undefined })
          return NextResponse.json({ success: true, remediated: true })
        } catch (ee: any) {
          return NextResponse.json({ error: 'User cannot be deleted due to existing references.', constraint: ee?.constraint, detail: ee?.detail }, { status: 409 })
        }
      }
      return NextResponse.json({ error: 'User cannot be deleted due to existing references. Please run migrations and try again.', constraint: constraint || undefined, detail: e?.detail || undefined }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}


