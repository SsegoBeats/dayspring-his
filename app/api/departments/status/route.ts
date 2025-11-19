import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"

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
  
  const { rows } = await query("SELECT role, is_active FROM users WHERE id = $1", [payload.userId])
  const user = rows[0]
  
  if (!user || !user.is_active) {
    return { error: "User not found or inactive", status: 401 }
  }
  
  return { user: { id: payload.userId, role: user.role } }
}

// GET /api/departments/status - Get real-time department status
export async function GET() {
  try {
    // Check authentication
    const authResult = await checkAuth()
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Define departments and their criteria for "active" status
    const departments = [
      {
        name: "Administration",
        roles: ["Hospital Admin"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5 // minutes
        }
      },
      {
        name: "Reception",
        roles: ["Receptionist"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      },
      {
        name: "Medical", 
        roles: ["Clinician"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      },
      {
        name: "Nursing",
        roles: ["Nurse"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      },
      {
        name: "Laboratory",
        roles: ["Lab Tech"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      },
      {
        name: "Radiology",
        roles: ["Radiologist"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      },
      {
        name: "Pharmacy",
        roles: ["Pharmacist"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      },
      {
        name: "Billing",
        roles: ["Cashier"],
        criteria: {
          hasActiveUsers: true,
          hasRecentActivity: true,
          activityThreshold: 5
        }
      }
    ]

    const departmentStatuses = []

    for (const dept of departments) {
      let status = "Inactive"
      let statusColor = "text-red-600"
      let details = ""
      let activityCount = 0

      // Check if department has active users
      // Use the first role for simplicity (each dept has one role)
      const role = dept.roles[0]
      const activeUsersQuery = await query(`
        SELECT COUNT(*) as count
        FROM users 
        WHERE is_active = true 
        AND (
          ($1 = 'Clinician' AND role IN ('Clinician','Doctor','Midwife','Dentist'))
          OR role = $1
        )
      `, [role])

      const activeUsersCount = parseInt(activeUsersQuery.rows[0]?.count || 0)

      if (activeUsersCount > 0) {
        // Check for recent activity based on department
        let recentActivityQuery = ""
        const minutes = Number((dept as any).criteria?.activityThreshold ?? 5)

        switch (dept.name) {
          case "Administration":
            // Check for recent user management/system activities and recent admin logins
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM users WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT created_at FROM audit_logs WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Hospital Admin' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Reception":
            // Check for recent patient registrations and appointments
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM patients WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT created_at FROM appointments WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Receptionist' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Medical":
            // Check for recent medical records and prescriptions
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM medical_records WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT created_at FROM prescriptions WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role IN ('Clinician','Doctor','Midwife','Dentist') AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Nursing":
            // Check for recent nursing notes and vital signs
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM nursing_notes WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT recorded_at as created_at FROM vital_signs WHERE recorded_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Nurse' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Laboratory":
            // Check for recent lab tests
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM lab_tests WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Lab Tech' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Radiology":
            // Check for recent radiology tests
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM radiology_tests WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Radiologist' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Pharmacy":
            // Check for recent prescriptions and medication activities
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM prescriptions WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT created_at FROM medications WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Pharmacist' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
          case "Billing":
            // Check for recent bills
            recentActivityQuery = `
              SELECT COUNT(*) as count FROM (
                SELECT created_at FROM bills WHERE created_at > NOW() - INTERVAL '${minutes} minutes'
                UNION ALL
                SELECT last_login as created_at FROM users WHERE role = 'Cashier' AND last_login IS NOT NULL AND last_login > NOW() - INTERVAL '${minutes} minutes'
              ) as activity
            `
            break
        }

        if (recentActivityQuery) {
          try {
            const activityResult = await query(recentActivityQuery, [])
            activityCount = parseInt(activityResult.rows[0]?.count || 0)
          } catch (queryError) {
            console.error(`Error executing activity query for ${dept.name}:`, queryError)
            activityCount = 0
          }
        } else {
          activityCount = 0
        }

        // Determine status based on activity
        if (activityCount > 0) {
          status = "Active"
          statusColor = "text-green-600"
          details = `${activeUsersCount} staff, ${activityCount} recent activities`
        } else {
          status = "Standby"
          statusColor = "text-yellow-600"
          details = `${activeUsersCount} staff, no recent activity`
        }
      } else {
        details = "No active staff"
      }

      departmentStatuses.push({
        name: dept.name,
        status,
        statusColor,
        details,
        activeUsers: activeUsersCount,
        recentActivity: activityCount
      })
    }

    return NextResponse.json({
      departments: departmentStatuses,
      lastUpdated: new Date().toISOString(),
      criteria: {
        activityThresholdMinutes: 5,
        description: "Department is considered active if it has active staff and recent activity (or login) within 5 minutes"
      }
    })

  } catch (error: any) {
    console.error("[Department Status API] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch department status",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}


