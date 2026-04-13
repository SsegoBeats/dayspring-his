import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { ORG_NAME, ORG_LOGO_PATH, ORG_EMAIL, ORG_PHONE, ORG_ADDRESS } from "@/lib/org-constants"

/**
 * Org settings are NOT used on the login route. The login page does not fetch org.
 * For extra safety: if the request originates from the login page, return empty settings.
 */
export async function GET(req: Request) {
  const referer = req.headers.get("referer")
  if (referer) {
    try {
      const u = new URL(referer)
      const path = u.pathname.replace(/\/$/, "") || "/"
      if (path === "/" || path.startsWith("/login")) {
        return NextResponse.json({ settings: {} })
      }
    } catch {}
  }
  const { rows } = await query(`SELECT currency FROM organization_settings WHERE id = 1`)
  const s = rows?.[0] || {}
  // Return hardcoded organization details from constants, only currency from database
  return NextResponse.json({ settings: {
    name: ORG_NAME,
    logoUrl: ORG_LOGO_PATH,
    email: ORG_EMAIL,
    phone: ORG_PHONE,
    address: ORG_ADDRESS,
    location: ORG_ADDRESS,
    currency: s.currency || 'UGX',
  } })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Match the same admin roles allowed into the admin settings page.
    const normalizedRole = String(auth.role || "").toLowerCase()
    if (normalizedRole !== "hospital admin" && normalizedRole !== "admin") {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(()=>({})) as any
    const { currency } = body || {}
    // Only currency can be updated - all other fields are hardcoded constants
    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 })
    }
    if (!['UGX', 'USD', 'KES'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }
    await query(`UPDATE organization_settings SET 
      currency = $1,
      updated_at = NOW()
      WHERE id = 1`, [currency])
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to update settings', details: e?.message }, { status: 500 })
  }
}
