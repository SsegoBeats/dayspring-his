import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"

const DEFAULT_PREFERENCES = {
  theme: "system",
  locale: "en-GB",
  timezone: "Africa/Kampala",
  currency: "UGX",
  dateFormat: "DD/MM/YYYY",
  defaultDashboard: "overview",
  queue_wait_warn: 30,
  queue_wait_crit: 60,
  service_warn: 30,
  service_crit: 60,
}

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

async function ensurePreferenceColumns() {
  await query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'timezone') THEN
          ALTER TABLE user_settings ADD COLUMN timezone VARCHAR(50) DEFAULT 'Africa/Kampala';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'date_format') THEN
          ALTER TABLE user_settings ADD COLUMN date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'default_dashboard') THEN
          ALTER TABLE user_settings ADD COLUMN default_dashboard VARCHAR(50) DEFAULT 'overview';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'queue_wait_warn') THEN
          ALTER TABLE user_settings ADD COLUMN queue_wait_warn INT DEFAULT 30;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'queue_wait_crit') THEN
          ALTER TABLE user_settings ADD COLUMN queue_wait_crit INT DEFAULT 60;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'service_warn') THEN
          ALTER TABLE user_settings ADD COLUMN service_warn INT DEFAULT 30;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'service_crit') THEN
          ALTER TABLE user_settings ADD COLUMN service_crit INT DEFAULT 60;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'extra_prefs') THEN
          ALTER TABLE user_settings ADD COLUMN extra_prefs JSONB DEFAULT '{}';
        END IF;
      END IF;
    END$$;
  `)
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensurePreferenceColumns()

    const { rows } = await query(
      "SELECT theme, locale, currency, timezone, date_format, default_dashboard, queue_wait_warn, queue_wait_crit, service_warn, service_crit, extra_prefs FROM user_settings WHERE user_id = $1",
      [payload.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({
        preferences: DEFAULT_PREFERENCES
      })
    }

    const extra = rows[0].extra_prefs && typeof rows[0].extra_prefs === "object" ? rows[0].extra_prefs : {}

    return NextResponse.json({
      preferences: {
        theme: rows[0].theme || DEFAULT_PREFERENCES.theme,
        locale: rows[0].locale || DEFAULT_PREFERENCES.locale,
        timezone: rows[0].timezone || DEFAULT_PREFERENCES.timezone,
        currency: rows[0].currency || DEFAULT_PREFERENCES.currency,
        dateFormat: rows[0].date_format || DEFAULT_PREFERENCES.dateFormat,
        defaultDashboard: rows[0].default_dashboard || DEFAULT_PREFERENCES.defaultDashboard,
        queue_wait_warn: rows[0].queue_wait_warn ?? DEFAULT_PREFERENCES.queue_wait_warn,
        queue_wait_crit: rows[0].queue_wait_crit ?? DEFAULT_PREFERENCES.queue_wait_crit,
        service_warn: rows[0].service_warn ?? DEFAULT_PREFERENCES.service_warn,
        service_crit: rows[0].service_crit ?? DEFAULT_PREFERENCES.service_crit,
        ...extra,
      }
    })
  } catch (error) {
    console.error("Error fetching preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

/** PATCH: store arbitrary extra preference keys (e.g. radiologistWorkflow) without overwriting core prefs. */
export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensurePreferenceColumns()

    const body = await req.json().catch(() => ({}))
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    // Merge into extra_prefs JSONB — safe partial update
    await query(
      `INSERT INTO user_settings (user_id, extra_prefs, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         extra_prefs = COALESCE(user_settings.extra_prefs, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()`,
      [payload.userId, JSON.stringify(body)],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error patching preferences:", error)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensurePreferenceColumns()

    const body = await req.json()
    const preferences = PreferencesSchema.parse(body)

    await query(
      `INSERT INTO user_settings (user_id, theme, locale, currency, timezone, date_format, default_dashboard, queue_wait_warn, queue_wait_crit, service_warn, service_crit, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         theme = EXCLUDED.theme,
         locale = EXCLUDED.locale,
         currency = EXCLUDED.currency,
         timezone = EXCLUDED.timezone,
         date_format = EXCLUDED.date_format,
         default_dashboard = EXCLUDED.default_dashboard,
         queue_wait_warn = COALESCE(EXCLUDED.queue_wait_warn, user_settings.queue_wait_warn),
         queue_wait_crit = COALESCE(EXCLUDED.queue_wait_crit, user_settings.queue_wait_crit),
         service_warn = COALESCE(EXCLUDED.service_warn, user_settings.service_warn),
         service_crit = COALESCE(EXCLUDED.service_crit, user_settings.service_crit),
         updated_at = CURRENT_TIMESTAMP`,
      [
        payload.userId,
        preferences.theme,
        preferences.locale,
        preferences.currency,
        preferences.timezone,
        preferences.dateFormat || "DD/MM/YYYY",
        preferences.defaultDashboard || "overview",
        preferences.queue_wait_warn ?? null,
        preferences.queue_wait_crit ?? null,
        preferences.service_warn ?? null,
        preferences.service_crit ?? null,
      ]
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


