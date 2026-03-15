import { query } from "@/lib/db"
import { RADIOLOGY_MODALITIES } from "@/lib/radiology"

// Treat "Active" as a very recent signal, then degrade quickly for operational monitoring.
export const DEPARTMENT_ACTIVE_THRESHOLD_MINUTES = 5
export const DEPARTMENT_STANDBY_THRESHOLD_MINUTES = 15
export const DEPARTMENT_IDLE_THRESHOLD_MINUTES = 30
export const DEPARTMENT_ACTIVITY_WINDOW_HOURS = 24
export const STAFF_ACTIVITY_WINDOW_HOURS = 24
export const WAIT_TIME_LOOKBACK_DAYS = 7

export interface AdminDepartmentStatus {
  name: string
  status: string
  statusColor: string
  details: string
  activeUsers: number
  recentActivityCount: number
  lastActivityAt: string | null
  lastActivityMinutes: number | null
}

export interface AdminOverviewSnapshot {
  quickStats: {
    averageWaitMinutes: number | null
    averageWaitSampleSize: number
    bedOccupancy: number
    totalBeds: number
    patientSatisfactionAvg: number | null
    patientSatisfactionTotal: number
    activeStaffAccounts: number
    activeStaffRecent: number
    staffActivityRate: number | null
  }
  departments: AdminDepartmentStatus[]
  lastUpdated: string
}

type DepartmentConfig = {
  name: string
  roles: string[]
  activitySql: string
}

function sqlStringLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

const radiologyModalitiesSql = RADIOLOGY_MODALITIES.map(sqlStringLiteral).join(", ")

const DEPARTMENTS: DepartmentConfig[] = [
  {
    name: "Administration",
    roles: ["Hospital Admin"],
    activitySql: `
      SELECT created_at AS activity_at FROM audit_logs
      UNION ALL
      SELECT created_at AS activity_at FROM users WHERE role = 'Hospital Admin'
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Hospital Admin' AND last_login IS NOT NULL
    `,
  },
  {
    name: "Reception",
    roles: ["Receptionist"],
    activitySql: `
      SELECT created_at AS activity_at FROM patients
      UNION ALL
      SELECT created_at AS activity_at FROM appointments
      UNION ALL
      SELECT created_at AS activity_at FROM checkins
      UNION ALL
      SELECT created_at AS activity_at FROM queue_events
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Receptionist' AND last_login IS NOT NULL
    `,
  },
  {
    name: "Medical",
    roles: ["Clinician", "Midwife", "Dentist"],
    activitySql: `
      SELECT created_at AS activity_at FROM medical_records
      UNION ALL
      SELECT created_at AS activity_at FROM prescriptions
      UNION ALL
      SELECT created_at AS activity_at FROM dental_records
      UNION ALL
      SELECT created_at AS activity_at FROM obstetric_assessments
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role IN ('Clinician', 'Midwife', 'Dentist') AND last_login IS NOT NULL
    `,
  },
  {
    name: "Nursing",
    roles: ["Nurse"],
    activitySql: `
      SELECT created_at AS activity_at FROM nursing_notes
      UNION ALL
      SELECT recorded_at AS activity_at FROM vital_signs
      UNION ALL
      SELECT updated_at AS activity_at FROM checkins
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Nurse' AND last_login IS NOT NULL
    `,
  },
  {
    name: "Laboratory",
    roles: ["Lab Tech"],
    activitySql: `
      SELECT ordered_at AS activity_at FROM lab_tests
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Lab Tech' AND last_login IS NOT NULL
    `,
  },
  {
    name: "Radiology",
    roles: ["Radiologist"],
    activitySql: `
      SELECT ordered_at AS activity_at
      FROM lab_tests
      WHERE COALESCE(NULLIF(test_name, ''), test_type) IN (${radiologyModalitiesSql})
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Radiologist' AND last_login IS NOT NULL
    `,
  },
  {
    name: "Pharmacy",
    roles: ["Pharmacist"],
    activitySql: `
      SELECT created_at AS activity_at FROM prescriptions
      UNION ALL
      SELECT created_at AS activity_at FROM medication_stock_movements
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Pharmacist' AND last_login IS NOT NULL
    `,
  },
  {
    name: "Billing",
    roles: ["Cashier"],
    activitySql: `
      SELECT created_at AS activity_at FROM bills
      UNION ALL
      SELECT created_at AS activity_at FROM payments
      UNION ALL
      SELECT last_login AS activity_at FROM users WHERE role = 'Cashier' AND last_login IS NOT NULL
    `,
  },
]

function classifyDepartment(activeUsers: number, lastActivityMinutes: number | null) {
  if (activeUsers <= 0) {
    return { status: "Inactive", statusColor: "text-red-600" }
  }
  if (lastActivityMinutes == null) {
    return { status: "Inactive", statusColor: "text-red-600" }
  }
  if (lastActivityMinutes <= DEPARTMENT_ACTIVE_THRESHOLD_MINUTES) {
    return { status: "Active", statusColor: "text-emerald-600" }
  }
  if (lastActivityMinutes <= DEPARTMENT_STANDBY_THRESHOLD_MINUTES) {
    return { status: "Standby", statusColor: "text-amber-600" }
  }
  if (lastActivityMinutes <= DEPARTMENT_IDLE_THRESHOLD_MINUTES) {
    return { status: "Idle", statusColor: "text-slate-600" }
  }
  return { status: "Inactive", statusColor: "text-red-600" }
}

export async function getDepartmentStatuses(): Promise<AdminDepartmentStatus[]> {
  return Promise.all(
    DEPARTMENTS.map(async (department) => {
      const activeUsersResult = await query<{ count: number }>(
        `
          SELECT COUNT(*)::int AS count
          FROM users
          WHERE is_active = true
            AND role = ANY($1::text[])
        `,
        [department.roles],
      )

      const activeUsers = Number(activeUsersResult.rows[0]?.count || 0)
      let recentActivityCount = 0
      let lastActivityAt: string | null = null

      try {
        const activityResult = await query<{ recent_count: number; last_activity_at: string | null }>(
          `
            SELECT
              COUNT(*) FILTER (
                WHERE activity_at >= NOW() - INTERVAL '${DEPARTMENT_ACTIVITY_WINDOW_HOURS} hours'
              )::int AS recent_count,
              MAX(activity_at)::timestamptz AS last_activity_at
            FROM (${department.activitySql}) activity
            WHERE activity_at IS NOT NULL
          `,
        )

        recentActivityCount = Number(activityResult.rows[0]?.recent_count || 0)
        lastActivityAt = activityResult.rows[0]?.last_activity_at || null
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[admin-overview] failed to load activity for ${department.name}:`, error)
        }
      }

      const lastActivityMinutes =
        lastActivityAt != null ? Math.max(0, Math.round((Date.now() - new Date(lastActivityAt).getTime()) / 60000)) : null

      const { status, statusColor } = classifyDepartment(activeUsers, lastActivityMinutes)

      let details = "No active staff assigned"
      if (activeUsers > 0) {
        if (recentActivityCount > 0) {
          details = `${activeUsers} staff, ${recentActivityCount} event${recentActivityCount === 1 ? "" : "s"} in ${DEPARTMENT_ACTIVITY_WINDOW_HOURS}h`
        } else if (lastActivityAt) {
          details = `${activeUsers} staff, no activity in ${DEPARTMENT_ACTIVITY_WINDOW_HOURS}h`
        } else {
          details = `${activeUsers} staff, no recorded activity yet`
        }
      }

      return {
        name: department.name,
        status,
        statusColor,
        details,
        activeUsers,
        recentActivityCount,
        lastActivityAt,
        lastActivityMinutes,
      }
    }),
  )
}

export async function getAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const [departments, bedSummary, patientFeedback, waitStats, staffActivity] = await Promise.all([
    getDepartmentStatuses(),
    query<{ total_beds: number; occupied_beds: number }>(`
      SELECT
        COUNT(*)::int AS total_beds,
        COUNT(*) FILTER (WHERE status = 'Occupied')::int AS occupied_beds
      FROM beds
    `).catch(() => ({ rows: [{ total_beds: 0, occupied_beds: 0 }] })),
    query<{ avg_rating: string | null; total_responses: number }>(`
      SELECT
        AVG(rating)::numeric(10,2) AS avg_rating,
        COUNT(*)::int AS total_responses
      FROM patient_feedback
    `).catch(() => ({ rows: [{ avg_rating: null, total_responses: 0 }] })),
    query<{ avg_wait_minutes: string | null; sample_size: number }>(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (e.created_at - c.created_at)) / 60.0)::numeric(10,2) AS avg_wait_minutes,
        COUNT(*)::int AS sample_size
      FROM queue_events e
      JOIN queues q ON q.id = e.queue_id
      JOIN checkins c ON c.id = q.checkin_id
      WHERE e.to_status = 'in_service'
        AND e.created_at >= NOW() - INTERVAL '${WAIT_TIME_LOOKBACK_DAYS} days'
    `).catch(() => ({ rows: [{ avg_wait_minutes: null, sample_size: 0 }] })),
    query<{ active_accounts: number; active_recent: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_accounts,
        COUNT(*) FILTER (
          WHERE is_active = true
            AND last_login >= NOW() - INTERVAL '${STAFF_ACTIVITY_WINDOW_HOURS} hours'
        )::int AS active_recent
      FROM users
    `).catch(() => ({ rows: [{ active_accounts: 0, active_recent: 0 }] })),
  ])

  const totalBeds = Number(bedSummary.rows[0]?.total_beds || 0)
  const occupiedBeds = Number(bedSummary.rows[0]?.occupied_beds || 0)
  const activeStaffAccounts = Number(staffActivity.rows[0]?.active_accounts || 0)
  const activeStaffRecent = Number(staffActivity.rows[0]?.active_recent || 0)
  const patientSatisfactionTotal = Number(patientFeedback.rows[0]?.total_responses || 0)
  const patientSatisfactionAvg =
    patientSatisfactionTotal > 0 && patientFeedback.rows[0]?.avg_rating != null
      ? Number(patientFeedback.rows[0].avg_rating)
      : null

  return {
    quickStats: {
      averageWaitMinutes: waitStats.rows[0]?.avg_wait_minutes != null ? Number(waitStats.rows[0].avg_wait_minutes) : null,
      averageWaitSampleSize: Number(waitStats.rows[0]?.sample_size || 0),
      bedOccupancy: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      totalBeds,
      patientSatisfactionAvg,
      patientSatisfactionTotal,
      activeStaffAccounts,
      activeStaffRecent,
      staffActivityRate: activeStaffAccounts > 0 ? Math.round((activeStaffRecent / activeStaffAccounts) * 100) : null,
    },
    departments,
    lastUpdated: new Date().toISOString(),
  }
}
