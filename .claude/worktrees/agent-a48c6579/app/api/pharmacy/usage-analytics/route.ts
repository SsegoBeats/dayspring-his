import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

// Record medication usage when dispensed
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      medicationId?: string
      quantity?: number
      prescriptionId?: string
    }

    const medicationId = (body.medicationId || "").trim()
    const quantity = Number(body.quantity ?? 0)
    const prescriptionId = body.prescriptionId ? String(body.prescriptionId).trim() || null : null

    if (!medicationId) {
      return NextResponse.json({ error: "medicationId is required" }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 })
    }

    const today = new Date()
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1) // First day of current month
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0) // Last day of current month

    // Check if record exists for this medication and period
    const { rows: existingRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, quantity_dispensed FROM medication_usage_analytics 
       WHERE medication_id = $1 AND period_start = $2 AND period_end = $3`,
      [medicationId, periodStart.toISOString().split("T")[0], periodEnd.toISOString().split("T")[0]],
    )

    if (existingRows.length > 0) {
      // Update existing record
      const existingQty = Number(existingRows[0].quantity_dispensed) || 0
      const newQty = existingQty + quantity
      const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
      const avgDailyUsage = newQty / Math.max(daysInPeriod, 1)

      await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `UPDATE medication_usage_analytics 
         SET quantity_dispensed = $1, average_daily_usage = $2
         WHERE id = $3`,
        [newQty, avgDailyUsage, existingRows[0].id],
      )
    } else {
      // Create new record
      const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
      const avgDailyUsage = quantity / Math.max(daysInPeriod, 1)

      await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `INSERT INTO medication_usage_analytics (
           medication_id,
           period_start,
           period_end,
           quantity_dispensed,
           average_daily_usage
         ) VALUES ($1, $2, $3, $4, $5)`,
        [medicationId, periodStart.toISOString().split("T")[0], periodEnd.toISOString().split("T")[0], quantity, avgDailyUsage],
      )
    }

    // Also record in stock movements (dispense tracking is handled separately in prescription flow)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Error recording usage analytics:", err)
    return NextResponse.json({ error: "Failed to record usage analytics" }, { status: 500 })
  }
}

// Get usage analytics and forecasts
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const medicationId = (url.searchParams.get("medicationId") || "").trim()
    const months = Math.min(Math.max(Number(url.searchParams.get("months")) || 6, 1), 24)

    const params: any[] = []
    let where = ""
    if (medicationId) {
      where = "WHERE mua.medication_id = $1"
      params.push(medicationId)
    }

    // Get historical usage data
    const { rows: usageRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT mua.id,
               mua.medication_id,
               m.name AS medication_name,
               mua.period_start,
               mua.period_end,
               mua.quantity_dispensed,
               mua.quantity_received,
               mua.average_daily_usage,
               mua.created_at
          FROM medication_usage_analytics mua
          JOIN medications m ON m.id = mua.medication_id
          ${where}
         ORDER BY mua.period_start DESC
         LIMIT ${months}
      `,
      params,
    )

    // Calculate forecasts for each medication
    const forecasts: Array<{
      medication_id: string
      medication_name: string
      historical_avg_daily: number
      forecasted_monthly: number
      forecasted_30_days: number
      forecasted_90_days: number
      trend: "increasing" | "decreasing" | "stable"
      confidence: number
    }> = []

    // Group by medication
    const byMedication = new Map<string, typeof usageRows>()
    usageRows.forEach((row) => {
      const medId = row.medication_id
      if (!byMedication.has(medId)) {
        byMedication.set(medId, [])
      }
      byMedication.get(medId)!.push(row)
    })

    for (const [medId, records] of byMedication.entries()) {
      if (records.length < 2) continue // Need at least 2 periods for trend analysis

      // Calculate average daily usage across all periods
      const totalUsage = records.reduce((sum, r) => sum + Number(r.quantity_dispensed || 0), 0)
      const totalDays = records.reduce((sum, r) => {
        const start = new Date(r.period_start)
        const end = new Date(r.period_end)
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }, 0)
      const historicalAvgDaily = totalUsage / Math.max(totalDays, 1)

      // Calculate trend (comparing last 2 periods)
      const sortedRecords = [...records].sort(
        (a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime(),
      )
      const lastPeriod = Number(sortedRecords[sortedRecords.length - 1]?.quantity_dispensed || 0)
      const prevPeriod = Number(sortedRecords[sortedRecords.length - 2]?.quantity_dispensed || 0)
      const changePercent = prevPeriod > 0 ? ((lastPeriod - prevPeriod) / prevPeriod) * 100 : 0

      let trend: "increasing" | "decreasing" | "stable" = "stable"
      if (changePercent > 10) trend = "increasing"
      else if (changePercent < -10) trend = "decreasing"

      // Calculate confidence based on data points
      const confidence = Math.min(100, Math.max(50, records.length * 15))

      // Forecasts
      const forecasted30Days = historicalAvgDaily * 30
      const forecasted90Days = historicalAvgDaily * 90
      const forecastedMonthly = historicalAvgDaily * 30

      forecasts.push({
        medication_id: medId,
        medication_name: records[0].medication_name,
        historical_avg_daily: historicalAvgDaily,
        forecasted_monthly: forecastedMonthly,
        forecasted_30_days: forecasted30Days,
        forecasted_90_days: forecasted90Days,
        trend,
        confidence,
      })
    }

    return NextResponse.json({
      usage: usageRows,
      forecasts: forecasts.sort((a, b) => b.forecasted_monthly - a.forecasted_monthly),
    })
  } catch (err: any) {
    console.error("Error fetching usage analytics:", err)
    return NextResponse.json({ error: "Failed to fetch usage analytics" }, { status: 500 })
  }
}

