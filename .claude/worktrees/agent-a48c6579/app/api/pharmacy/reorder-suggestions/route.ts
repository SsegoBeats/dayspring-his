import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Get medications needing reorder
    let rows: any[] = []
    try {
      const res = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT * FROM get_medications_needing_reorder()`,
      )
      rows = res.rows
    } catch (err) {
      const fallback = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `
          SELECT 
            m.id AS medication_id,
            m.name AS medication_name,
            m.stock_quantity AS current_stock,
            m.min_stock_level,
            m.reorder_level,
            CASE 
              WHEN m.max_stock_level IS NOT NULL 
                THEN GREATEST(m.max_stock_level - m.stock_quantity, m.reorder_level - m.stock_quantity)
              ELSE GREATEST(m.reorder_level * 2 - m.stock_quantity, m.reorder_level - m.stock_quantity)
            END AS suggested_order_quantity,
            CASE 
              WHEN m.last_restocked_at IS NOT NULL 
                THEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - m.last_restocked_at))::INTEGER
              ELSE NULL
            END AS days_since_last_restock
          FROM medications m
          WHERE m.stock_quantity <= COALESCE(m.min_stock_level, m.reorder_level)
          ORDER BY (m.stock_quantity::NUMERIC / NULLIF(GREATEST(m.min_stock_level, m.reorder_level, 1), 0)) ASC
        `,
      )
      rows = fallback.rows
    }

    return NextResponse.json({ suggestions: rows })
  } catch (err: any) {
    console.error("Error fetching reorder suggestions:", err)
    return NextResponse.json({ error: "Failed to fetch reorder suggestions" }, { status: 500 })
  }
}

