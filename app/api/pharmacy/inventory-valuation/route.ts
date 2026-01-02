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

    // Calculate inventory valuation
    const { rows: valuationRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT * FROM calculate_inventory_valuation()`,
    )

    // Get breakdown by category
    const { rows: categoryRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT 
          m.category,
          COUNT(*) AS medication_count,
          SUM(m.stock_quantity) AS total_quantity,
          COALESCE(SUM(m.stock_quantity * COALESCE(m.cost_price, 0)), 0) AS total_cost_value,
          COALESCE(SUM(m.stock_quantity * m.unit_price), 0) AS total_selling_value
        FROM medications m
        WHERE m.stock_quantity > 0
        GROUP BY m.category
        ORDER BY total_selling_value DESC
      `,
    )

    // Get top 10 most valuable medications
    const { rows: topMedications } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT 
          id,
          name,
          category,
          stock_quantity,
          unit_price,
          cost_price,
          (stock_quantity * unit_price) AS total_value,
          (stock_quantity * COALESCE(cost_price, 0)) AS total_cost
        FROM medications
        WHERE stock_quantity > 0
        ORDER BY (stock_quantity * unit_price) DESC
        LIMIT 10
      `,
    )

    return NextResponse.json({
      valuation: valuationRows[0] || {
        total_cost_value: 0,
        total_selling_value: 0,
        total_profit_margin: 0,
        medication_count: 0,
      },
      byCategory: categoryRows,
      topMedications: topMedications,
    })
  } catch (err: any) {
    console.error("Error calculating inventory valuation:", err)
    return NextResponse.json({ error: "Failed to calculate inventory valuation" }, { status: 500 })
  }
}

