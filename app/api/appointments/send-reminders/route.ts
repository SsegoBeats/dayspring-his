import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { emailTemplates } from "@/lib/email-service"
import nodemailer from "nodemailer"
import { ORG_EMAIL } from "@/lib/org-constants"

const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "465", 10)
const SMTP_SECURE =
  process.env.SMTP_SECURE != null ? process.env.SMTP_SECURE === "true" : SMTP_PORT === 465
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.MAIL_USER || ORG_EMAIL
const SMTP_PASS =
  process.env.SMTP_PASS ||
  process.env.SMTP_PASSWORD ||
  process.env.EMAIL_PASS ||
  process.env.EMAIL_PASSWORD ||
  process.env.GMAIL_APP_PASSWORD ||
  process.env.GOOGLE_APP_PASSWORD ||
  ""
const SMTP_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || `Dayspring HIS <${ORG_EMAIL}>`

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  })
}

export async function POST(req: Request) {
  // Accept either a cron secret (server-to-server) or an authenticated admin session
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Authorized via cron secret — proceed
  } else {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  try {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const startDate = now.toISOString().slice(0, 10)
    const endDate = in24h.toISOString().slice(0, 10)

    // Fetch appointments scheduled in the next 24 hours and not cancelled
    const { rows: appts } = await query<{
      id: string
      appointment_date: string
      appointment_time: string
      department: string
      status: string
      patient_email: string | null
      patient_name: string
      doctor_name: string | null
    }>(
      `
      SELECT a.id,
             a.appointment_date,
             a.appointment_time,
             a.department,
             a.status,
             p.email AS patient_email,
             CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
             u.name AS doctor_name
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      LEFT JOIN users u ON u.id = a.doctor_id
      WHERE a.status = 'Scheduled'
        AND a.appointment_date BETWEEN $1 AND $2
      `,
      [startDate, endDate],
    )

    if (appts.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    const transporter = getTransporter()
    let sentCount = 0
    const from = SMTP_FROM

    for (const a of appts) {
      if (!a.patient_email) continue

      // Skip if already sent
      const { rows: already } = await query<{ count: string }>(
        "SELECT COUNT(1) FROM appointment_reminders WHERE appointment_id = $1",
        [a.id],
      )
      if (already[0] && Number.parseInt(already[0].count) > 0) continue

      const dateStr = a.appointment_date
      const timeStr = a.appointment_time.toString().slice(0, 5)

      // Build email
      const template = emailTemplates.appointmentConfirmation(
        a.patient_name,
        a.doctor_name || "",
        dateStr,
        timeStr,
        a.department,
      )

      await transporter.sendMail({ from, to: a.patient_email, subject: template.subject, html: template.html })
      await query("INSERT INTO appointment_reminders (appointment_id) VALUES ($1) ON CONFLICT DO NOTHING", [a.id])
      sentCount += 1
    }

    return NextResponse.json({ success: true, sent: sentCount })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}


