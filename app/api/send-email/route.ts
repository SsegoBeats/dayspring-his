import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { z } from "zod"
import { rateLimitPg } from "@/lib/rate-limit-pg"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { writeAuditLog } from "@/lib/audit"
import { query } from "@/lib/db"
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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})

const EmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(3).max(200),
  html: z.string().min(1).max(100_000),
})

// ── Minimal server-side HTML sanitizer ────────────────────────────────────────
// Removes <script>, <iframe>, <object>, <embed>, event handler attributes,
// javascript: URLs, and data: URLs from the HTML body before sending.
// This prevents a compromised Hospital Admin account from embedding
// credential-harvesting scripts or tracking payloads in outbound emails.
function sanitizeEmailHtml(raw: string): string {
  return raw
    // Strip dangerous tags and their content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/<form[^>]*>/gi, "")
    .replace(/<\/form>/gi, "")
    // Strip event handler attributes (onclick, onload, etc.)
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Strip javascript: and data: href/src/action values
    .replace(/\s(?:href|src|action)\s*=\s*"(?:javascript|data):[^"]*"/gi, "")
    .replace(/\s(?:href|src|action)\s*=\s*'(?:javascript|data):[^']*'/gi, "")
}

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

    // ── Recipient allowlist ───────────────────────────────────────────────────
    // Only send to addresses registered in the system (patients or staff).
    // Prevents using the hospital's SMTP account to send phishing to arbitrary
    // external addresses.
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM users    WHERE lower(email) = lower($1) AND is_active = true
       UNION ALL
       SELECT id FROM patients WHERE lower(email) = lower($1)
       LIMIT 1`,
      [to],
    )
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Recipient email address is not registered in the system." },
        { status: 403 },
      )
    }

    // ── Sanitize HTML before sending ─────────────────────────────────────────
    const safeHtml = sanitizeEmailHtml(html)

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html: safeHtml,
    })

    await writeAuditLog({ action: "email_sent", entityType: "email", details: { to, subject }, ip })

    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    console.error("[send-email] Email sending error:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
