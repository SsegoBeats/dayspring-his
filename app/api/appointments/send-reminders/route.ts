import { NextResponse } from "next/server"
import { query, withClient } from "@/lib/db"
import { emailTemplates } from "@/lib/email-service"
import nodemailer from "nodemailer"

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number.parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "dayspringmedicalcenter@gmail.com",
      pass: process.env.SMTP_PASS || "",
    },
  })
}

export async function POST() {
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

    // Ensure reminders table exists
    await withClient(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS appointment_reminders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
          sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (appointment_id)
        );
      `)
    })

    const transporter = getTransporter()
    let sentCount = 0
    const from = process.env.SMTP_FROM || "Dayspring HIS <dayspringmedicalcenter@gmail.com>"

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


