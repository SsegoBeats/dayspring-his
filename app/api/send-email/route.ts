import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { writeAuditLog } from "@/lib/audit"

// SMTP configuration from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "dayspringmedicalcenter@gmail.com",
    pass: process.env.SMTP_PASS || "",
  },
})

const EmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(3).max(200),
  html: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const ip = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1").split(",")[0]
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth || !can(auth.role, "email", "create")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await rateLimitPg(`email:${ip}`, 20, 60))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const { to, subject, html } = EmailSchema.parse(await request.json())

    // Validate input
    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Missing required fields: to, subject, html" }, { status: 400 })
    }

    // Send email
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || "Dayspring HIS <dayspringmedicalcenter@gmail.com>",
      to,
      subject,
      html,
    })

    await writeAuditLog({ action: "email_sent", entityType: "email", details: { to, subject }, ip })

    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    console.error("[v0] Email sending error:", error)
    return NextResponse.json(
      { error: "Failed to send email", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
