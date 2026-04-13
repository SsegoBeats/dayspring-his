import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const search = (url.searchParams.get("q") || "").trim()
  const limit = Math.max(1, Math.min(40, Number(url.searchParams.get("limit") || 20)))

  if (!search) return NextResponse.json({ items: [] })

  const like = `%${search.toLowerCase()}%`
  const { rows } = await query(
    `SELECT loinc_code, long_common_name, shortname, component, property, time_aspct, system, scale_typ, method_typ, class, units, example_units
       FROM loinc_tests
      WHERE LOWER(loinc_code) LIKE $1
         OR LOWER(long_common_name) LIKE $1
         OR LOWER(shortname) LIKE $1
      ORDER BY long_common_name ASC
      LIMIT $2`,
    [like, limit]
  )

  return NextResponse.json({
    items: rows.map((r: any) => ({
      loincCode: r.loinc_code,
      name: r.long_common_name || r.shortname || r.loinc_code,
      shortname: r.shortname,
      component: r.component,
      property: r.property,
      timeAspct: r.time_aspct,
      system: r.system,
      scale: r.scale_typ,
      method: r.method_typ,
      class: r.class,
      units: r.units || r.example_units || null,
    })),
  })
}
