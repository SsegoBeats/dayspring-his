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

    let sinceIso: string | null = null
    if (sinceParam === "today") {
      sinceIso = startOfDayISO(new Date())
    } else if (/^\d{4}-\d{2}-\d{2}/.test(sinceParam)) {
      sinceIso = startOfDayISO(new Date(sinceParam))
    }

    const params: any[] = []
    let idx = 1
    const where: string[] = []
    if (fromDate && toDate) {
      where.push(`DATE(nn.created_at) BETWEEN $${idx} AND $${idx + 1}`)
      params.push(fromDate, toDate)
      idx += 2
    } else if (sinceIso) {
      where.push(`nn.created_at >= $${idx++}`)
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
      FROM nursing_notes nn
      LEFT JOIN patients p ON p.id = nn.patient_id
      ${whereSql}
    `
    const countResult = await query(countSql, params)
    const count = Number(countResult.rows?.[0]?.count ?? 0)

    if (summaryOnly) {
      return NextResponse.json({
        notes: [],
        summary: { count, todaysCount: count },
      })
    }

    const sql = `
      SELECT DISTINCT ON (nn.patient_id)
        nn.id, nn.patient_id, nn.nurse_id, nn.note_type, nn.note, nn.created_at,
        p.first_name, p.last_name, p.patient_number,
        u.name AS nurse_name
      FROM nursing_notes nn
      LEFT JOIN patients p ON p.id = nn.patient_id
      LEFT JOIN users u ON u.id = nn.nurse_id
      ${whereSql}
      ORDER BY nn.patient_id, nn.created_at DESC
      LIMIT $${idx}
    `
    params.push(limit)

    const { rows } = await query(sql, params)

    return NextResponse.json({
      notes: rows,
      summary: { count, todaysCount: count },
    })
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to load latest notes", details: e.message }, { status: 500 })
  }
}
