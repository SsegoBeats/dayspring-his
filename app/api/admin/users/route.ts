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
  const offset = (page - 1) * pageSize
  const params: any[] = []
  let where = ""
  if (search) {
    where = "WHERE name ILIKE $1 OR email ILIKE $1"
    params.push(`%${search}%`)
  }
  const { rows } = await query(
    `SELECT id, name, email, role, is_active AS status, created_at, last_login, email_verified_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
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
    "Doctor",
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
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role, is_active, email_verified_at) VALUES ($1,$2,$3,$4,true,NULL) RETURNING id`,
    [input.email, hash, input.name, input.role],
  )

  const userId = rows[0].id

  // Generate OTP code for email verification
  const crypto = await import('crypto')
  const otp = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

  // Store OTP in database
  await query(
    `INSERT INTO email_verification_tokens (user_id, token, new_email, expires_at, used)
     VALUES ($1, $2, $3, $4, false)`,
    [userId, otp, input.email, expiresAt.toISOString()]
  )

  // Send welcome email (without verification code - user gets that on first login)
  try {
    const welcomeTpl = emailTemplates.welcome(input.name, input.email, input.password, input.role)
    await sendEmailServer(input.email, welcomeTpl)
  } catch (error) {
    console.error("[User Creation] Failed to send welcome email:", error)
    // Don't fail user creation if email fails
  }

  // Send verification code email separately
  try {
    const { emailTemplates: vEmailTemplates } = await import("@/lib/email-service")
    const verificationTpl = vEmailTemplates.verificationCode(input.name, otp)
    await sendEmailServer(input.email, verificationTpl)
  } catch (error) {
    console.error("[User Creation] Failed to send verification email:", error)
    // Don't fail user creation if verification email fails
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


