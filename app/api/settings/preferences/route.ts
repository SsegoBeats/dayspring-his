import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"

const PreferencesSchema = z.object({
  theme: z.string(),
  locale: z.string(),
  timezone: z.string(),
  currency: z.string(),
  dateFormat: z.string().optional(),
  defaultDashboard: z.string().optional(),
  queue_wait_warn: z.number().int().min(0).max(600).optional(),
  queue_wait_crit: z.number().int().min(0).max(600).optional(),
  service_warn: z.number().int().min(0).max(600).optional(),
  service_crit: z.number().int().min(0).max(600).optional(),
})

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Ensure SLA columns exist for upgraded databases
    try {
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_warn INT DEFAULT 30")
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_crit INT DEFAULT 60")
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_warn INT DEFAULT 30")
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_crit INT DEFAULT 60")
    } catch {}

    const { rows } = await query(
      "SELECT theme, locale, currency, timezone, queue_wait_warn, queue_wait_crit, service_warn, service_crit FROM user_settings WHERE user_id = $1",
      [payload.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({
        preferences: {
          theme: "system",
          locale: "en-GB",
          timezone: "Africa/Kampala",
          currency: "UGX",
          queue_wait_warn: 30,
          queue_wait_crit: 60,
          service_warn: 30,
          service_crit: 60,
        }
      })
    }

    return NextResponse.json({
      preferences: {
        theme: rows[0].theme || "system",
        locale: rows[0].locale || "en-GB",
        timezone: rows[0].timezone || "Africa/Kampala",
        currency: rows[0].currency || "UGX",
        queue_wait_warn: rows[0].queue_wait_warn ?? 30,
        queue_wait_crit: rows[0].queue_wait_crit ?? 60,
        service_warn: rows[0].service_warn ?? 30,
        service_crit: rows[0].service_crit ?? 60,
      }
    })
  } catch (error) {
    console.error("Error fetching preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const preferences = PreferencesSchema.parse(body)
    // Ensure columns exist before upsert
    try {
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_warn INT DEFAULT 30")
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS queue_wait_crit INT DEFAULT 60")
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_warn INT DEFAULT 30")
      await query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS service_crit INT DEFAULT 60")
    } catch {}

    await query(
      `INSERT INTO user_settings (user_id, theme, locale, currency, timezone, queue_wait_warn, queue_wait_crit, service_warn, service_crit, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         theme = EXCLUDED.theme,
         locale = EXCLUDED.locale,
         currency = EXCLUDED.currency,
         timezone = EXCLUDED.timezone,
         queue_wait_warn = COALESCE(EXCLUDED.queue_wait_warn, user_settings.queue_wait_warn),
         queue_wait_crit = COALESCE(EXCLUDED.queue_wait_crit, user_settings.queue_wait_crit),
         service_warn = COALESCE(EXCLUDED.service_warn, user_settings.service_warn),
         service_crit = COALESCE(EXCLUDED.service_crit, user_settings.service_crit),
         updated_at = CURRENT_TIMESTAMP`,
      [payload.userId, preferences.theme, preferences.locale, preferences.currency, preferences.timezone, preferences.queue_wait_warn ?? null, preferences.queue_wait_crit ?? null, preferences.service_warn ?? null, preferences.service_crit ?? null]
    )

    return NextResponse.json({ success: true, message: "Preferences updated successfully" })
  } catch (error) {
    console.error("Error updating preferences:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}


