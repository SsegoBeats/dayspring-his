import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

async function ensure() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS organization_settings (
      id INT PRIMARY KEY DEFAULT 1,
      name VARCHAR(200),
      logo_url TEXT,
      email VARCHAR(200),
      phone VARCHAR(100),
      address TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
    await query(`INSERT INTO organization_settings (id, name) VALUES (1, 'Dayspring Medical Center') ON CONFLICT (id) DO NOTHING`)
  } catch {}
}

export async function GET() {
  await ensure()
  const { rows } = await query(`SELECT name, logo_url, email, phone, address FROM organization_settings WHERE id = 1`)
  const s = rows?.[0] || {}
  return NextResponse.json({ settings: {
    name: s.name || 'Dayspring Medical Center',
    logoUrl: s.logo_url || '/logo.png',
    email: s.email || 'dayspringmedicalcenter@gmail.com',
    phone: s.phone || '+256 703-942-230 / +256 703-844-396 / +256 742-918-253',
    location: s.location || 'Wanyange, Uganda',
    address: s.address || 'Kampala, Uganda'
  } })
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Only Hospital Admin should be able to change organization-level settings
    if (auth.role !== 'Hospital Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensure()
    const body = await req.json().catch(()=>({})) as any
    const { name, logoUrl, email, phone, address } = body || {}
    await query(`UPDATE organization_settings SET 
      name = COALESCE($1, name),
      logo_url = COALESCE($2, logo_url),
      email = COALESCE($3, email),
      phone = COALESCE($4, phone),
      address = COALESCE($5, address),
      updated_at = NOW()
      WHERE id = 1`, [name ?? null, logoUrl ?? null, email ?? null, phone ?? null, address ?? null])
    return NextResponse.json({ success: true })
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to update settings', details: e?.message }, { status: 500 })
  }
}
