import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { generateToken, verifyPassword } from "@/lib/security"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { writeAuditLog } from "@/lib/audit"
import { query } from "@/lib/db"
import { normalizeRole } from "@/lib/auth-roles"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
    if (!(await rateLimitPg(`login:${ip}`, 10, 60))) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
    }

    const body = await req.json()
    const { email, password, role } = LoginSchema.parse(body)
    const normalizedRole = normalizeRole(role)
    if (!normalizedRole) {
      return NextResponse.json({ error: "Please select a valid role." }, { status: 400 })
    }

    // Per-account rate limiting: prevents credential stuffing from distributed IPs
    if (!(await rateLimitPg(`login:account:${email.toLowerCase()}`, 5, 900))) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
    }

    const { rows } = await query<{
      id: string
      email: string
      password_hash: string
      name: string
      role: string
      is_active: boolean
      locked_until: string | null
      failed_login_attempts: number
      email_verified_at: string | null
    }>("SELECT id, email, password_hash, name, role, is_active, locked_until, failed_login_attempts, email_verified_at FROM users WHERE lower(email) = lower($1)", [email])

    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return NextResponse.json({ error: "Account temporarily locked. Try again later." }, { status: 423 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const storedRole = normalizeRole(user.role)
    if (!storedRole || storedRole !== normalizedRole) {
      await writeAuditLog({
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        details: { category: "AUTHENTICATION", description: `Role mismatch for ${user.email}` },
        ip,
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      const nextAttempts = (user.failed_login_attempts || 0) + 1
      const lockedUntil = nextAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null
      await query(`UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`, [nextAttempts, lockedUntil, user.id])
      await writeAuditLog({ 
        action: "LOGIN_FAILED", 
        entityType: "User", 
        entityId: user.id, 
        details: { category: "AUTHENTICATION", description: `Failed login attempt for ${user.email}` }, 
        ip 
      })
      return NextResponse.json({ error: nextAttempts >= 5 ? "Account temporarily locked. Try again later." : "Invalid credentials" }, { status: nextAttempts >= 5 ? 423 : 401 })
    }

    await query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id])

    const token = generateToken(user.id, user.email, storedRole)
    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: storedRole,
      emailVerified: !!user.email_verified_at,
    })
    const isProduction = process.env.NODE_ENV === "production"
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    })
    // Non-HttpOnly fallback in development for browsers that ignore dev Set-Cookie
    if (!isProduction) {
      res.cookies.set("session_dev", token, {
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      })
    }
    // Also set in the request cookie store (dev quirk in some browsers)
    try {
      const store = await cookies()
      store.set("session", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      })
      if (!isProduction) {
        store.set("session_dev", token, {
          httpOnly: false,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 8,
        })
      }
    } catch {}
    // Update last_login timestamp for activity and department status
    try { await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]) } catch {}
    await writeAuditLog({ 
      userId: user.id,
      action: "LOGIN", 
      entityType: "User", 
      entityId: user.id, 
      details: { category: "AUTHENTICATION", description: `User ${user.name} logged in as ${storedRole}` }, 
      ip 
    })
    return res
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    }
    console.error("[auth/login] Unexpected login error:", err)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
