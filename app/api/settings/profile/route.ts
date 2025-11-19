import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"

const ProfileSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  department: z.string().optional(),
  signature: z.string().optional(),
})

async function ensureUserProfileColumns() {
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)`)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signature TEXT`)
  } catch {
    // If this fails, the main queries will surface real errors.
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureUserProfileColumns()

    const { rows } = await query("SELECT name, phone, department, signature, email FROM users WHERE id = $1", [
      payload.userId,
    ])

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ profile: rows[0] })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureUserProfileColumns()

    const body = await req.json()
    const { name, phone, department, signature } = ProfileSchema.parse(body)

    await query(
      "UPDATE users SET name = $1, phone = $2, department = $3, signature = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
      [name, phone || null, department || null, signature || null, payload.userId],
    )

    return NextResponse.json({ success: true, message: "Profile updated successfully" })
  } catch (error) {
    console.error("Error updating profile:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
