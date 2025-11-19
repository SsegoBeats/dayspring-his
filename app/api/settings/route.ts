import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { z } from "zod"
import { query } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ settings: null }, { status: 401 })
    const { rows } = await query(
      `SELECT theme, locale, currency, notify_email_reminders as "notifyEmailReminders" FROM user_settings WHERE user_id = $1`,
      [auth.userId],
    )
    const settings = rows[0] || { theme: "system", locale: "en-GB", currency: "UGX", notifyEmailReminders: true }
    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

const SettingsSchema = z.object({ theme: z.string(), locale: z.string(), currency: z.string(), notifyEmailReminders: z.boolean() })

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json()
    const data = SettingsSchema.parse(body)
    await query(
      `INSERT INTO user_settings (user_id, theme, locale, currency, notify_email_reminders)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, locale = EXCLUDED.locale, currency = EXCLUDED.currency, notify_email_reminders = EXCLUDED.notify_email_reminders, updated_at = CURRENT_TIMESTAMP`,
      [auth.userId, data.theme, data.locale, data.currency, data.notifyEmailReminders],
    )
    return NextResponse.json({ success: true, message: "Settings updated successfully" })
  } catch (error: any) {
    console.error("Error updating settings:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}


