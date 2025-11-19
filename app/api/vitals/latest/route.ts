import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

function startOfDayISO(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "medical", "read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const sinceParam = url.searchParams.get("since") || "today"
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 500)))
    const q = (url.searchParams.get("q") || "").trim()

    // Since filter
    let sinceIso: string | null = null
    if (sinceParam === "today") {
      sinceIso = startOfDayISO(new Date())
    } else if (/^\d{4}-\d{2}-\d{2}/.test(sinceParam)) {
      // YYYY-MM-DD
      sinceIso = startOfDayISO(new Date(sinceParam))
    }

    const params: any[] = []
    let idx = 1
    const where: string[] = []
    if (sinceIso) {
      where.push(`COALESCE(vs.recorded_at, vs.created_at) >= $${idx++}`)
      params.push(sinceIso)
    }
    if (q) {
      where.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR p.patient_number ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    // Latest vitals per patient using DISTINCT ON
    const sql = `
      SELECT DISTINCT ON (vs.patient_id)
        vs.id, vs.patient_id, vs.nurse_id,
        vs.blood_pressure_systolic, vs.blood_pressure_diastolic,
        vs.heart_rate, vs.temperature, vs.respiratory_rate,
        vs.oxygen_saturation, vs.weight, vs.height, vs.notes,
        COALESCE(vs.recorded_at, vs.created_at) AS recorded_at,
        p.first_name, p.last_name, p.patient_number,
        u.name AS nurse_name,
        t.category AS triage_category
      FROM vital_signs vs
      LEFT JOIN patients p ON p.id = vs.patient_id
      LEFT JOIN users u ON u.id = vs.nurse_id
      LEFT JOIN LATERAL (
        SELECT category, COALESCE(recorded_at, created_at) AS t_recorded
        FROM triage_assessments ta
        WHERE ta.patient_id = vs.patient_id
        ORDER BY COALESCE(recorded_at, created_at) DESC
        LIMIT 1
      ) t ON true
      ${whereSql}
      ORDER BY vs.patient_id, COALESCE(vs.recorded_at, vs.created_at) DESC
      LIMIT $${idx}
    `
    params.push(limit)

    const { rows } = await query(sql, params)
    const today = new Date(startOfDayISO(new Date())).getTime()
    const todaysCount = rows.filter((r: any) => new Date(r.recorded_at || r.created_at || new Date()).getTime() >= today).length

    return NextResponse.json({
      vitals: rows,
      summary: {
        count: rows.length,
        todaysCount,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to load latest vitals", details: e.message }, { status: 500 })
  }
}
