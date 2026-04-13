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
    const fromDate = url.searchParams.get("from")
    const toDate = url.searchParams.get("to")
    const summaryOnly = url.searchParams.get("summaryOnly") === "1"
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
    if (fromDate && toDate) {
      where.push(`DATE(COALESCE(vs.recorded_at, NOW())) BETWEEN $${idx} AND $${idx + 1}`)
      params.push(fromDate, toDate)
      idx += 2
    } else if (sinceIso) {
      where.push(`vs.recorded_at >= $${idx++}`)
      params.push(sinceIso)
    }
    if (q) {
      where.push(`(p.first_name ILIKE $${idx} OR p.last_name ILIKE $${idx} OR CAST(p.patient_number AS TEXT) ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM vital_signs vs
      LEFT JOIN patients p ON p.id = vs.patient_id
      ${whereSql}
    `
    const countResult = await query(countSql, params)
    const count = Number(countResult.rows?.[0]?.count ?? 0)

    if (summaryOnly) {
      return NextResponse.json({
        vitals: [],
        summary: {
          count,
          todaysCount: count,
        },
      })
    }

    // Latest vitals per patient using DISTINCT ON
    const sql = `
      SELECT DISTINCT ON (vs.patient_id)
        vs.id, vs.patient_id, vs.nurse_id,
        vs.blood_pressure_systolic, vs.blood_pressure_diastolic,
        vs.heart_rate, vs.temperature, vs.respiratory_rate,
        vs.oxygen_saturation, vs.weight, vs.height, vs.notes,
        vs.recorded_at AS recorded_at,
        p.first_name, p.last_name, p.patient_number,
        u.name AS nurse_name,
        t.category AS triage_category
      FROM vital_signs vs
      LEFT JOIN patients p ON p.id = vs.patient_id
      LEFT JOIN users u ON u.id = vs.nurse_id
      LEFT JOIN LATERAL (
        SELECT category
        FROM triage_assessments ta
        WHERE ta.patient_id = vs.patient_id
        ORDER BY ta.created_at DESC
        LIMIT 1
      ) t ON true
      ${whereSql}
      ORDER BY vs.patient_id, vs.recorded_at DESC
      LIMIT $${idx}
    `
    params.push(limit)

    let rows
    try {
      const result = await query(sql, params)
      rows = result.rows
    } catch (e: any) {
      // Fallback for deployments that don't yet have triage_assessments table or columns.
      // If the join fails (eg. relation does not exist), re-run a simpler query without triage.
      const msg = String(e?.message || "")
      const code = (e as any)?.code
      if (msg.includes("triage_assessments") || code === "42P01" || code === "42703") {
        const fallbackSql = `
          SELECT DISTINCT ON (vs.patient_id)
            vs.id, vs.patient_id, vs.nurse_id,
            vs.blood_pressure_systolic, vs.blood_pressure_diastolic,
            vs.heart_rate, vs.temperature, vs.respiratory_rate,
            vs.oxygen_saturation, vs.weight, vs.height, vs.notes,
            vs.recorded_at AS recorded_at,
            p.first_name, p.last_name, p.patient_number,
            u.name AS nurse_name,
            NULL::text AS triage_category
          FROM vital_signs vs
          LEFT JOIN patients p ON p.id = vs.patient_id
          LEFT JOIN users u ON u.id = vs.nurse_id
          ${whereSql}
          ORDER BY vs.patient_id, vs.recorded_at DESC
          LIMIT $${idx}
        `
        const fallback = await query(fallbackSql, params)
        rows = fallback.rows
      } else {
        throw e
      }
    }
    return NextResponse.json({
      vitals: rows,
      summary: {
        count,
        todaysCount: count,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to load latest vitals", details: e.message }, { status: 500 })
  }
}
