import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import {
  DEPARTMENT_ACTIVE_THRESHOLD_MINUTES,
  DEPARTMENT_ACTIVITY_WINDOW_HOURS,
  DEPARTMENT_IDLE_THRESHOLD_MINUTES,
  DEPARTMENT_STANDBY_THRESHOLD_MINUTES,
  getDepartmentStatuses,
} from "@/lib/admin-overview"

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

  const { rows } = await query<{ role: string; is_active: boolean }>(
    "SELECT role, is_active FROM users WHERE id = $1",
    [payload.userId],
  )

  const user = rows[0]
  if (!user || !user.is_active) {
    return { error: "User not found or inactive", status: 401 }
  }

  return { user: { id: payload.userId, role: user.role } }
}

export async function GET() {
  try {
    const authResult = await checkAuth()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    return NextResponse.json({
      departments: await getDepartmentStatuses(),
      lastUpdated: new Date().toISOString(),
      criteria: {
        activityThresholdMinutes: DEPARTMENT_ACTIVE_THRESHOLD_MINUTES,
        standbyThresholdMinutes: DEPARTMENT_STANDBY_THRESHOLD_MINUTES,
        idleThresholdMinutes: DEPARTMENT_IDLE_THRESHOLD_MINUTES,
        activityWindowHours: DEPARTMENT_ACTIVITY_WINDOW_HOURS,
        description:
          "Department status is based on active staff assignment and the most recent clinical, operational, or login activity.",
      },
    })
  } catch (error: any) {
    console.error("[Department Status API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch department status",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    )
  }
}
