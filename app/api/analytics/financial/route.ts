import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

// Helper function to check authentication
async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  
  if (!token) {
    return { error: "Authentication required", status: 401 }
  }
  
  const payload = verifyToken(token)
  if (!payload) {
    return { error: "Invalid token", status: 401 }
  }
  
  // Get user role from database
  const { rows } = await query("SELECT role, is_active FROM users WHERE id = $1", [payload.userId])
  const user = rows[0]
  
  if (!user || !user.is_active) {
    return { error: "User not found or inactive", status: 401 }
  }
  
  // Only Hospital Admin and Cashier can access financial analytics
  if (!["Hospital Admin", "Cashier"].includes(user.role)) {
    return { error: "Insufficient permissions", status: 403 }
  }
  
  return { user: { id: payload.userId, role: user.role } }
}

// GET /api/analytics/financial - Get comprehensive financial analytics
export async function GET(request: Request) {
  try {
    const authResult = await checkAuth()
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || '30days'

    // Calculate date range based on period
    let dateFilter = ''
    let params: any[] = []
    let paramIndex = 1

    if (startDate && endDate) {
      dateFilter = `WHERE b.created_at >= $${paramIndex} AND b.created_at <= $${paramIndex + 1}`
      params.push(startDate, endDate)
      paramIndex += 2
    } else {
      // Use period-based filtering
      const days = period === '7days' ? 7 : period === '30days' ? 30 : 90
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      dateFilter = `WHERE b.created_at >= $${paramIndex}`
      params.push(cutoffDate.toISOString().split('T')[0])
      paramIndex++
    }

    // Get comprehensive financial summary
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN b.final_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN b.status = 'Pending' THEN b.final_amount ELSE 0 END), 0) as outstanding_balance,
        COALESCE(AVG(CASE WHEN b.status = 'Paid' THEN b.final_amount END), 0) as avg_transaction_value,
        COUNT(CASE WHEN b.status = 'Paid' THEN 1 END) as paid_transactions,
        COUNT(CASE WHEN b.status = 'Pending' THEN 1 END) as pending_transactions,
        COUNT(DISTINCT CASE WHEN b.status = 'Paid' THEN b.payment_method END) as active_payment_methods
      FROM bills b
      ${dateFilter}
    `

    const summaryResult = await query(summaryQuery, params)
    const summary = summaryResult.rows[0]

    // Get daily revenue trend
    const dailyRevenueQuery = `
      SELECT 
        DATE(b.created_at) as date,
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN b.final_amount ELSE 0 END), 0) as revenue,
        COUNT(CASE WHEN b.status = 'Paid' THEN 1 END) as transactions
      FROM bills b
      ${dateFilter}
      GROUP BY DATE(b.created_at)
      ORDER BY DATE(b.created_at) ASC
    `

    const dailyRevenueResult = await query(dailyRevenueQuery, params)

    // Get revenue by department
    const departmentRevenueQuery = `
      SELECT 
        COALESCE(a.department, 'General') as department,
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN bi.total_price ELSE 0 END), 0) as revenue,
        COUNT(CASE WHEN b.status = 'Paid' THEN 1 END) as transactions
      FROM bills b
      LEFT JOIN bill_items bi ON b.id = bi.bill_id
      LEFT JOIN appointments a ON b.patient_id = a.patient_id
      ${dateFilter}
      GROUP BY COALESCE(a.department, 'General')
      ORDER BY revenue DESC
    `

    const departmentRevenueResult = await query(departmentRevenueQuery, params)

    // Get revenue by payment method
    const paymentMethodQuery = `
      SELECT 
        COALESCE(b.payment_method, 'Unknown') as payment_method,
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN b.final_amount ELSE 0 END), 0) as revenue,
        COUNT(CASE WHEN b.status = 'Paid' THEN 1 END) as transactions
      FROM bills b
      ${dateFilter}
      GROUP BY COALESCE(b.payment_method, 'Unknown')
      ORDER BY revenue DESC
    `

    const paymentMethodResult = await query(paymentMethodQuery, params)

    // Get top services
    const topServicesQuery = `
      SELECT 
        bi.description as service,
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN bi.total_price ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN bi.quantity ELSE 0 END), 0) as count
      FROM bills b
      LEFT JOIN bill_items bi ON b.id = bi.bill_id
      ${dateFilter}
      AND bi.description IS NOT NULL
      GROUP BY bi.description
      ORDER BY revenue DESC
      LIMIT 10
    `

    const topServicesResult = await query(topServicesQuery, params)

    // Get patient visit statistics
    let appointmentDateFilter = ''
    let appointmentParams: any[] = []
    let appointmentParamIndex = 1

    if (startDate && endDate) {
      appointmentDateFilter = `WHERE a.appointment_date >= $${appointmentParamIndex} AND a.appointment_date <= $${appointmentParamIndex + 1}`
      appointmentParams.push(startDate, endDate)
    } else {
      const days = period === '7days' ? 7 : period === '30days' ? 30 : 90
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      appointmentDateFilter = `WHERE a.appointment_date >= $${appointmentParamIndex}`
      appointmentParams.push(cutoffDate.toISOString().split('T')[0])
    }

    const patientVisitsQuery = `
      SELECT 
        DATE(a.appointment_date) as date,
        COUNT(*) as visits
      FROM appointments a
      ${appointmentDateFilter}
      GROUP BY DATE(a.appointment_date)
      ORDER BY DATE(a.appointment_date) ASC
    `

    const patientVisitsResult = await query(patientVisitsQuery, appointmentParams)

    // Calculate growth metrics
    const previousPeriodQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN b.status = 'Paid' THEN b.final_amount ELSE 0 END), 0) as previous_revenue
      FROM bills b
      WHERE b.created_at < $1 AND b.created_at >= $2
    `

    const previousPeriodDays = period === '7days' ? 7 : period === '30days' ? 30 : 90
    const previousCutoffDate = new Date()
    previousCutoffDate.setDate(previousCutoffDate.getDate() - (previousPeriodDays * 2))
    const currentCutoffDate = new Date()
    currentCutoffDate.setDate(currentCutoffDate.getDate() - previousPeriodDays)

    const previousPeriodResult = await query(previousPeriodQuery, [
      currentCutoffDate.toISOString().split('T')[0],
      previousCutoffDate.toISOString().split('T')[0]
    ])

    const previousRevenue = previousPeriodResult.rows[0]?.previous_revenue || 0
    const currentRevenue = summary.total_revenue || 0
    const revenueGrowth = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0

    return NextResponse.json({
      summary: {
        totalRevenue: parseFloat(summary.total_revenue) || 0,
        outstandingBalance: parseFloat(summary.outstanding_balance) || 0,
        avgTransactionValue: parseFloat(summary.avg_transaction_value) || 0,
        paidTransactions: parseInt(summary.paid_transactions) || 0,
        pendingTransactions: parseInt(summary.pending_transactions) || 0,
        activePaymentMethods: parseInt(summary.active_payment_methods) || 0,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100
      },
      dailyRevenue: dailyRevenueResult.rows.map(row => ({
        date: row.date,
        revenue: parseFloat(row.revenue) || 0,
        transactions: parseInt(row.transactions) || 0
      })),
      revenueByDepartment: departmentRevenueResult.rows.map(row => ({
        department: row.department,
        revenue: parseFloat(row.revenue) || 0,
        transactions: parseInt(row.transactions) || 0
      })),
      revenueByPaymentMethod: paymentMethodResult.rows.map(row => ({
        paymentMethod: row.payment_method,
        revenue: parseFloat(row.revenue) || 0,
        transactions: parseInt(row.transactions) || 0
      })),
      topServices: topServicesResult.rows.map(row => ({
        service: row.service,
        revenue: parseFloat(row.revenue) || 0,
        count: parseInt(row.count) || 0
      })),
      patientVisits: patientVisitsResult.rows.map(row => ({
        date: row.date,
        visits: parseInt(row.visits) || 0
      }))
    })

  } catch (error: any) {
    console.error("[Financial Analytics API] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch financial analytics",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}
