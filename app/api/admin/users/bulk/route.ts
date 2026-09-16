import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

const VALID_ROLES = [
  "Receptionist", "Clinician", "Radiologist", "Nurse", "Lab Tech",
  "Hospital Admin", "Cashier", "Pharmacist", "Midwife", "Dentist",
] as const

const BulkSchema = z.object({
  action: z.enum(["activate", "deactivate", "changeRole"]),
  userIds: z.array(z.string().uuid()).min(1).max(100),
  role: z.enum(VALID_ROLES).optional(),
})

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "users", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  // Re-verify role from DB to guard against stale JWTs
  const { rows: fresh } = await query<{ role: string; is_active: boolean }>(
    "SELECT role, is_active FROM users WHERE id = $1", [auth.userId]
  )
  if (!fresh[0]?.is_active || !can(fresh[0].role, "users", "update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const input = BulkSchema.parse(body)

  const includesCurrentUser = input.userIds.includes(auth.userId)

  if (includesCurrentUser && input.action === "deactivate") {
    return NextResponse.json({ error: "You cannot deactivate your own account from bulk actions." }, { status: 400 })
  }

  if (includesCurrentUser && input.action === "changeRole") {
    return NextResponse.json({ error: "You cannot change your own role from bulk actions." }, { status: 400 })
  }

  if (input.action === "changeRole" && !input.role) {
    return NextResponse.json({ error: "role is required for changeRole action" }, { status: 400 })
  }

  // Prevent lockout: ensure at least one active Hospital Admin remains after the operation
  if (input.action === "deactivate" || (input.action === "changeRole" && input.role !== "Hospital Admin")) {
    const { rows: adminRows } = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'Hospital Admin' AND is_active = true`
    )
    const affectedAdmins = adminRows.filter((r) => input.userIds.includes(r.id))
    const remainingAdmins = adminRows.length - affectedAdmins.length
    if (remainingAdmins < 1) {
      return NextResponse.json(
        { error: "This operation would remove the last active Hospital Admin. At least one active admin must remain." },
        { status: 400 }
      )
    }
  }

  const placeholdersAct = input.userIds.map((_, i) => `$${i + 1}`).join(", ")
  const placeholdersRole = input.userIds.map((_, i) => `$${i + 2}`).join(", ")

  if (input.action === "activate") {
    const result = await query(
      `UPDATE users SET is_active = true, updated_at = NOW() WHERE id IN (${placeholdersAct})`,
      input.userIds
    )
    const updated = (result as { rowCount?: number }).rowCount ?? input.userIds.length
    try {
      await writeAuditLog({
        action: "bulk_activate",
        entityType: "user",
        userId: auth.userId,
        details: { count: updated, userIds: input.userIds },
      })
    } catch {}
    return NextResponse.json({ success: true, updated })
  }

  if (input.action === "deactivate") {
    const result = await query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id IN (${placeholdersAct})`,
      input.userIds
    )
    const updated = (result as { rowCount?: number }).rowCount ?? input.userIds.length
    try {
      await writeAuditLog({
        action: "bulk_deactivate",
        entityType: "user",
        userId: auth.userId,
        details: { count: updated, userIds: input.userIds },
      })
    } catch {}
    return NextResponse.json({ success: true, updated })
  }

  if (input.action === "changeRole") {
    const result = await query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id IN (${placeholdersRole})`,
      [input.role, ...input.userIds]
    )
    const updated = (result as { rowCount?: number }).rowCount ?? input.userIds.length
    try {
      await writeAuditLog({
        action: "bulk_change_role",
        entityType: "user",
        userId: auth.userId,
        details: { role: input.role, count: updated, userIds: input.userIds },
      })
    } catch {}
    return NextResponse.json({ success: true, updated })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
