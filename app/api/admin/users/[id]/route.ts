import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

const UpdateSchema = z.object({
  // Only allow role and status updates for security
  role: z
    .enum([
      "Receptionist",
      "Clinician",
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

type UserReference = {
  table_name: string
  column_name: string
  constraint_name: string
  delete_rule: string
  is_nullable: "YES" | "NO"
  is_primary_key: boolean
}

const USER_OWNED_TABLES = new Set([
  "doctor_schedules",
  "email_verification_tokens",
  "notification_user_states",
  "password_reset_tokens",
  "user_settings",
])

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, `""`)}"`
}

async function cleanupUserReferences(userId: string) {
  const { rows: refs } = await query<UserReference>(
    `SELECT
       tc.table_name,
       kcu.column_name,
       tc.constraint_name,
       rc.delete_rule,
       cols.is_nullable,
       EXISTS (
         SELECT 1
         FROM information_schema.table_constraints pk
         JOIN information_schema.key_column_usage pk_kcu
           ON pk.constraint_name = pk_kcu.constraint_name
          AND pk.constraint_schema = pk_kcu.constraint_schema
         WHERE pk.constraint_type = 'PRIMARY KEY'
           AND pk.table_schema = tc.table_schema
           AND pk.table_name = tc.table_name
           AND pk_kcu.column_name = kcu.column_name
       ) AS is_primary_key
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name
      AND tc.constraint_schema = ccu.constraint_schema
     JOIN information_schema.referential_constraints rc
       ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
     JOIN information_schema.columns cols
       ON cols.table_schema = tc.table_schema
      AND cols.table_name = tc.table_name
      AND cols.column_name = kcu.column_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND ccu.table_schema = 'public'
       AND ccu.table_name = 'users'
       AND ccu.column_name = 'id'
     ORDER BY tc.table_name, kcu.column_name`,
  )

  for (const ref of refs) {
    const table = quoteIdentifier(ref.table_name)
    const column = quoteIdentifier(ref.column_name)

    if (USER_OWNED_TABLES.has(ref.table_name) || ref.is_primary_key) {
      await query(`DELETE FROM ${table} WHERE ${column} = $1`, [userId]).catch(() => {})
      continue
    }

    const updateSql = `UPDATE ${table} SET ${column} = NULL WHERE ${column} = $1`

    try {
      await query(updateSql, [userId])
      continue
    } catch (error: any) {
      const code = String(error?.code || "")
      const deleteRule = String(ref.delete_rule || "").toUpperCase()
      const needsNormalization =
        ref.is_nullable !== "YES" ||
        deleteRule !== "SET NULL" ||
        code === "23502" ||
        code === "23503"

      if (!needsNormalization) {
        throw error
      }
    }

    const constraint = quoteIdentifier(ref.constraint_name)
    try {
      await query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`)
    } catch {}
    try {
      await query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint}`)
      await query(
        `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE SET NULL`,
      )
    } catch {}

    await query(updateSql, [userId])
  }
}

export async function PUT(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "users", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (auth.userId === id) {
    return NextResponse.json({ error: "You cannot change your own role or status from User Management." }, { status: 400 })
  }

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
  if (auth.userId === id) {
    return NextResponse.json({ error: "You cannot delete your own account from User Management." }, { status: 400 })
  }
  try {
    await cleanupUserReferences(id)
    await query(`DELETE FROM users WHERE id = $1`, [id])
    await writeAuditLog({ action: "user_delete", entityType: "user", entityId: id, userId: auth.userId })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    const code = e?.code || ''
    if (code === '23503') {
      return NextResponse.json(
        { error: "User cannot be deleted because related records still reference this account." },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}


