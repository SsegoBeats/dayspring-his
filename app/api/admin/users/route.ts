import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can, hashPassword, validatePasswordStrength } from "@/lib/security"
import { query } from "@/lib/db"
import { sendEmailServer, emailTemplates } from "@/lib/email-service"
import { writeAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "users", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get("page") || 1))
  const pageSize = Math.max(1, Math.min(50, Number(url.searchParams.get("pageSize") || 20)))
  const search = (url.searchParams.get("q") || "").trim()
  const role = url.searchParams.get("role") || ""
  const status = url.searchParams.get("status") || ""
  const createdAfter = url.searchParams.get("createdAfter") || ""
  const createdBefore = url.searchParams.get("createdBefore") || ""
  const sortBy = url.searchParams.get("sortBy") || "created_at"
  const sortOrder = url.searchParams.get("sortOrder") || "desc"

  const offset = (page - 1) * pageSize
  const conditions: string[] = []
  const params: any[] = []
  let idx = 1

  if (search) {
    conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`)
    params.push(`%${search}%`)
    idx++
  }
  if (role) {
    conditions.push(`role = $${idx}`)
    params.push(role)
    idx++
  }
  if (status) {
    if (status === "active") conditions.push("is_active = true")
    else if (status === "inactive") conditions.push("is_active = false")
  }
  if (createdAfter) {
    conditions.push(`created_at >= $${idx}`)
    params.push(createdAfter)
    idx++
  }
  if (createdBefore) {
    conditions.push(`created_at <= $${idx}`)
    params.push(createdBefore)
    idx++
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  // Summary-only request for dashboard stats
  const summaryOnly = url.searchParams.get("summary") === "1"
  if (summaryOnly) {
    const { rows: summaryRows } = await query(
      `SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active,
        COUNT(*) FILTER (WHERE is_active = false)::int AS inactive
       FROM users ${where}`,
      params,
    )
    const { rows: roleRows } = await query(
      `SELECT role, COUNT(*)::int AS count FROM users ${where} GROUP BY role`,
      params,
    )
    const byRole: Record<string, number> = {}
    for (const r of roleRows) byRole[r.role] = r.count
    return NextResponse.json({
      summary: { total: summaryRows[0]?.total || 0, active: summaryRows[0]?.active || 0, inactive: summaryRows[0]?.inactive || 0, byRole },
    })
  }

  const allowedSort = ["name", "email", "role", "created_at", "last_login", "is_active"].includes(sortBy)
    ? sortBy === "is_active" ? "is_active" : sortBy
    : "created_at"
  const orderDir = sortOrder === "asc" ? "ASC" : "DESC"
  const orderCol = allowedSort === "is_active" ? "is_active" : allowedSort

  const { rows } = await query(
    `SELECT id, name, email, role, is_active AS status, created_at, last_login, email_verified_at FROM users ${where} ORDER BY ${orderCol} ${orderDir} LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset],
  )
  const { rows: totalRows } = await query(`SELECT COUNT(1)::int AS total FROM users ${where}`, params)
  return NextResponse.json({ users: rows, total: totalRows[0]?.total || 0, page, pageSize })
}

const CreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([
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
  ]),
})

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "users", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const input = CreateSchema.parse(body)

  // Validate password strength
  const strength = validatePasswordStrength(input.password)
  if (!strength.valid) {
    return NextResponse.json({ 
      error: "Weak password", 
      details: strength.errors 
    }, { status: 400 })
  }

  const hash = await hashPassword(input.password)
  
  let userId: string
  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, role, is_active, email_verified_at) VALUES ($1,$2,$3,$4,true,NULL) RETURNING id`,
      [input.email, hash, input.name, input.role],
    )
    userId = rows[0].id
  } catch (error: any) {
    // Handle duplicate email error
    if (error?.code === "23505" && error?.constraint === "users_email_key") {
      return NextResponse.json(
        { error: "Email already exists", details: `A user with email ${input.email} already exists. Please use a different email address.` },
        { status: 409 }
      )
    }
    // Re-throw other errors
    throw error
  }

  // Ensure table exists, then store verification token for new user
  const { ensureEmailVerificationTable } = await import('@/lib/email-verification')
  await ensureEmailVerificationTable()

  let otp: string | undefined
  try {
    const crypto = await import('crypto')
    otp = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours for initial verification
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, new_email, expires_at, used)
       VALUES ($1, $2, $3, $4, false)`,
      [userId, otp, input.email, expiresAt.toISOString()]
    )
  } catch (e) {
    otp = undefined
    if (process.env.NODE_ENV === 'development') console.warn('[User Creation] email_verification_tokens insert failed:', (e as Error)?.message)
  }

  // Send welcome email (without verification code - user gets that on first login)
  try {
    const welcomeTpl = emailTemplates.welcome(input.name, input.email, input.password, input.role)
    await sendEmailServer(input.email, welcomeTpl)
  } catch (error) {
    console.error("[User Creation] Failed to send welcome email:", error)
    // Don't fail user creation if email fails
  }

  // Send verification code email separately (only when OTP was stored)
  if (typeof otp !== 'undefined') {
    try {
      const { emailTemplates: vEmailTemplates } = await import("@/lib/email-service")
      const verificationTpl = vEmailTemplates.verificationCode(input.name, otp)
      await sendEmailServer(input.email, verificationTpl)
    } catch (error) {
      console.error("[User Creation] Failed to send verification email:", error)
    }
  }

  // Log the user creation action
  await writeAuditLog({
    userId: auth.userId,
    action: "CREATE",
    entityType: "User",
    entityId: userId,
    details: {
      category: "USER_MANAGEMENT",
      description: `New user created: ${input.name} (${input.email}) with role ${input.role}`,
      changes: [
        { field: "name", oldValue: null, newValue: input.name },
        { field: "email", oldValue: null, newValue: input.email },
        { field: "role", oldValue: null, newValue: input.role }
      ]
    },
    ip: "127.0.0.1"
  })

  return NextResponse.json({ id: userId })
}


