import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import {
  DEPARTMENT_ACTIVE_THRESHOLD_MINUTES,
  DEPARTMENT_ACTIVITY_WINDOW_HOURS,
  DEPARTMENT_STANDBY_THRESHOLD_MINUTES,
  STAFF_ACTIVITY_WINDOW_HOURS,
  WAIT_TIME_LOOKBACK_DAYS,
  getAdminOverviewSnapshot,
} from "@/lib/admin-overview"

async function checkAdminAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value

  if (!token) {
    return { error: "Authentication required", status: 401 }
  }

  const payload = verifyToken(token)
  if (!payload) {
    return { error: "Invalid token", status: 401 }
  }

  const { rows } = await query<{ role: string; is_active: boolean }>(
    "SELECT role, is_active FROM users WHERE id = $1",
    [payload.userId],
  )

  const user = rows[0]
  const normalizedRole = (user?.role || "").toLowerCase()
  if (!user || !user.is_active) {
    return { error: "User not found or inactive", status: 401 }
  }
  if (normalizedRole !== "hospital admin" && normalizedRole !== "admin") {
    return { error: "Forbidden", status: 403 }
  }

  return { user: { id: payload.userId, role: user.role } }
}

export async function GET() {
  try {
    const authResult = await checkAdminAuth()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const snapshot = await getAdminOverviewSnapshot()
    return NextResponse.json({
      ...snapshot,
      criteria: {
        departmentActiveThresholdMinutes: DEPARTMENT_ACTIVE_THRESHOLD_MINUTES,
        departmentStandbyThresholdMinutes: DEPARTMENT_STANDBY_THRESHOLD_MINUTES,
        departmentActivityWindowHours: DEPARTMENT_ACTIVITY_WINDOW_HOURS,
        staffActivityWindowHours: STAFF_ACTIVITY_WINDOW_HOURS,
        waitTimeLookbackDays: WAIT_TIME_LOOKBACK_DAYS,
      },
    })
  } catch (error: any) {
    console.error("[Admin Overview API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch admin overview",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    )
  }
}
