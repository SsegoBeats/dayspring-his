import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { generateToken, verifyPassword } from "@/lib/security"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { writeAuditLog } from "@/lib/audit"
import { query } from "@/lib/db"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string(),
})

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
    if (!(await rateLimitPg(`login:${ip}`, 10, 60))) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
    }

    const body = await req.json()
    const { email, password, role } = LoginSchema.parse(body)

    const { rows } = await query<{
      id: string
      email: string
      password_hash: string
      name: string
      role: string
      is_active: boolean
      email_verified_at: string | null
    }>("SELECT id, email, password_hash, name, role, is_active, email_verified_at FROM users WHERE lower(email) = lower($1)", [email])

    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    
    if (!user.is_active) {
      return NextResponse.json({ 
        error: "Account Deactivated", 
        message: "Your account has been deactivated. Please contact your system administrator to restore access.",
        code: "ACCOUNT_INACTIVE"
      }, { status: 403 })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      await writeAuditLog({ 
        action: "LOGIN_FAILED", 
        entityType: "User", 
        entityId: user.id, 
        details: { category: "AUTHENTICATION", description: `Failed login attempt for ${user.email}` },
        ip 
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Validate that the selected role matches the user's actual role
    if (user.role !== role) {
      await writeAuditLog({ 
        action: "LOGIN_FAILED", 
        entityType: "User", 
        entityId: user.id, 
        details: { category: "AUTHENTICATION", description: `Role mismatch login attempt for ${user.email} - selected: ${role}, actual: ${user.role}` },
        ip 
      })
      return NextResponse.json({ 
        error: `You do not have access to the ${role} portal. Your role is: ${user.role}` 
      }, { status: 403 })
    }

      const token = generateToken(user.id, user.email, user.role)
      // Set cookie on response and include token in body for dev helpers
      const res = NextResponse.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        emailVerified: !!user.email_verified_at,
        token 
      })
      res.cookies.set("session", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      })
      // Non-HttpOnly fallback in development for browsers that ignore dev Set-Cookie
      if (process.env.NODE_ENV !== "production") {
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
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 8,
        })
        if (process.env.NODE_ENV !== "production") {
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
      details: { category: "AUTHENTICATION", description: `User ${user.name} logged in as ${user.role}` },
      ip 
    })
    return res
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}



