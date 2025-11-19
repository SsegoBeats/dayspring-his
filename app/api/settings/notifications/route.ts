import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { z } from "zod"

const NotificationsSchema = z.object({
  emailReminders: z.boolean(),
  appointmentAlerts: z.boolean(),
  labResults: z.boolean(),
  systemUpdates: z.boolean(),
  emergencyAlerts: z.boolean(),
})

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { rows } = await query(
      "SELECT notify_email_reminders, appointment_alerts, lab_results, system_updates, emergency_alerts FROM user_settings WHERE user_id = $1",
      [payload.userId]
    )

    if (rows.length === 0) {
      // Return defaults if no settings exist
      return NextResponse.json({
        notifications: {
          emailReminders: true,
          appointmentAlerts: true,
          labResults: true,
          systemUpdates: false,
          emergencyAlerts: true
        }
      })
    }

    return NextResponse.json({
      notifications: {
        emailReminders: rows[0].notify_email_reminders ?? true,
        appointmentAlerts: rows[0].appointment_alerts ?? true,
        labResults: rows[0].lab_results ?? true,
        systemUpdates: rows[0].system_updates ?? false,
        emergencyAlerts: rows[0].emergency_alerts ?? true
      }
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const notifications = NotificationsSchema.parse(body)

    // Upsert notification settings
    await query(
      `INSERT INTO user_settings (user_id, notify_email_reminders, appointment_alerts, lab_results, system_updates, emergency_alerts, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         notify_email_reminders = EXCLUDED.notify_email_reminders,
         appointment_alerts = EXCLUDED.appointment_alerts,
         lab_results = EXCLUDED.lab_results,
         system_updates = EXCLUDED.system_updates,
         emergency_alerts = EXCLUDED.emergency_alerts,
         updated_at = CURRENT_TIMESTAMP`,
      [
        payload.userId,
        notifications.emailReminders,
        notifications.appointmentAlerts,
        notifications.labResults,
        notifications.systemUpdates,
        notifications.emergencyAlerts
      ]
    )

    return NextResponse.json({ success: true, message: "Notification preferences updated successfully" })
  } catch (error) {
    console.error("Error updating notifications:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}

