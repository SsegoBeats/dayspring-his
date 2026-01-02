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

    // Get medication usage data for the last 12 months
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    // Calculate annual consumption value for each medication
    // Annual consumption value = (unit_price * quantity_dispensed) over 12 months
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT 
          m.id,
          m.name,
          m.category,
          m.unit_price,
          m.cost_price,
          COALESCE(SUM(mua.quantity_dispensed), 0) AS annual_quantity_dispensed,
          COALESCE(SUM(mua.quantity_dispensed * m.unit_price), 0) AS annual_consumption_value,
          COALESCE(SUM(mua.quantity_dispensed * COALESCE(m.cost_price, 0)), 0) AS annual_cost_value,
          m.stock_quantity,
          m.reorder_level,
          m.min_stock_level,
          m.max_stock_level
        FROM medications m
        LEFT JOIN medication_usage_analytics mua ON m.id = mua.medication_id 
          AND mua.period_start >= $1
        WHERE m.stock_quantity > 0 OR COALESCE(SUM(mua.quantity_dispensed), 0) > 0
        GROUP BY m.id, m.name, m.category, m.unit_price, m.cost_price, m.stock_quantity, m.reorder_level, m.min_stock_level, m.max_stock_level
        ORDER BY annual_consumption_value DESC
      `,
      [twelveMonthsAgo.toISOString().split("T")[0]],
    )

    // Calculate total consumption value
    const totalValue = rows.reduce((sum, r) => sum + Number(r.annual_consumption_value || 0), 0)

    // Categorize medications into A, B, C
    // A: Top 20% of items contributing to 80% of value
    // B: Next 30% of items contributing to 15% of value
    // C: Remaining 50% of items contributing to 5% of value
    let cumulativeValue = 0
    const categorized = rows.map((row, index) => {
      const value = Number(row.annual_consumption_value || 0)
      cumulativeValue += value
      const cumulativePercent = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0
      const itemPercent = ((index + 1) / rows.length) * 100

      let category: "A" | "B" | "C" = "C"
      if (cumulativePercent <= 80 && itemPercent <= 20) {
        category = "A"
      } else if (cumulativePercent <= 95 && itemPercent <= 50) {
        category = "B"
      } else {
        category = "C"
      }

      return {
        medication_id: row.id,
        medication_name: row.name,
        category: row.category,
        abc_category: category,
        unit_price: Number(row.unit_price),
        cost_price: row.cost_price ? Number(row.cost_price) : null,
        annual_quantity_dispensed: Number(row.annual_quantity_dispensed),
        annual_consumption_value: value,
        annual_cost_value: Number(row.annual_cost_value || 0),
        stock_quantity: Number(row.stock_quantity),
        reorder_level: Number(row.reorder_level || 0),
        min_stock_level: row.min_stock_level ? Number(row.min_stock_level) : null,
        max_stock_level: row.max_stock_level ? Number(row.max_stock_level) : null,
        value_percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
        cumulative_percentage: cumulativePercent,
      }
    })

    // Calculate summary statistics
    const summary = {
      total_medications: categorized.length,
      total_annual_value: totalValue,
      category_a: {
        count: categorized.filter((c) => c.abc_category === "A").length,
        total_value: categorized.filter((c) => c.abc_category === "A").reduce((sum, c) => sum + c.annual_consumption_value, 0),
        percentage: totalValue > 0
          ? (categorized.filter((c) => c.abc_category === "A").reduce((sum, c) => sum + c.annual_consumption_value, 0) / totalValue) * 100
          : 0,
      },
      category_b: {
        count: categorized.filter((c) => c.abc_category === "B").length,
        total_value: categorized.filter((c) => c.abc_category === "B").reduce((sum, c) => sum + c.annual_consumption_value, 0),
        percentage: totalValue > 0
          ? (categorized.filter((c) => c.abc_category === "B").reduce((sum, c) => sum + c.annual_consumption_value, 0) / totalValue) * 100
          : 0,
      },
      category_c: {
        count: categorized.filter((c) => c.abc_category === "C").length,
        total_value: categorized.filter((c) => c.abc_category === "C").reduce((sum, c) => sum + c.annual_consumption_value, 0),
        percentage: totalValue > 0
          ? (categorized.filter((c) => c.abc_category === "C").reduce((sum, c) => sum + c.annual_consumption_value, 0) / totalValue) * 100
          : 0,
      },
    }

    return NextResponse.json({
      medications: categorized,
      summary,
    })
  } catch (err: any) {
    console.error("Error calculating ABC analysis:", err)
    return NextResponse.json({ error: "Failed to calculate ABC analysis" }, { status: 500 })
  }
}

