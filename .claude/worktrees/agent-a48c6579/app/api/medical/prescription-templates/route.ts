import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const category = (url.searchParams.get("category") || "").trim()
    const search = (url.searchParams.get("search") || "").trim()

    let where = "WHERE is_active = TRUE"
    const params: any[] = []

    if (category) {
      where += " AND category = $" + (params.length + 1)
      params.push(category)
    }

    if (search) {
      where += " AND (LOWER(template_name) LIKE $" + (params.length + 1) + " OR LOWER(medication_name) LIKE $" + (params.length + 1) + ")"
      params.push(`%${search.toLowerCase()}%`)
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, template_name, category, medication_name, dosage, frequency, duration, instructions, conditions
       FROM prescription_templates
       ${where}
       ORDER BY template_name ASC`,
      params,
    )

    return NextResponse.json({ templates: rows })
  } catch (err: any) {
    console.error("Error fetching prescription templates:", err)
    return NextResponse.json({ error: "Failed to fetch prescription templates" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      templateName?: string
      category?: string
      medicationName?: string
      dosage?: string
      frequency?: string
      duration?: string
      instructions?: string
      conditions?: string[]
    }

    const templateName = (body.templateName || "").trim()
    const medicationName = (body.medicationName || "").trim()
    const dosage = (body.dosage || "").trim()
    const frequency = (body.frequency || "").trim()
    const duration = (body.duration || "").trim()

    if (!templateName || !medicationName || !dosage || !frequency || !duration) {
      return NextResponse.json({ error: "templateName, medicationName, dosage, frequency, and duration are required" }, { status: 400 })
    }

    const category = body.category ? String(body.category).trim() || null : null
    const instructions = body.instructions ? String(body.instructions).trim() || null : null
    const conditions = Array.isArray(body.conditions) ? body.conditions.filter((c) => c && String(c).trim()) : []

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO prescription_templates (
         template_name, category, medication_name, dosage, frequency, duration, instructions, conditions, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, template_name, category, medication_name, dosage, frequency, duration, instructions, conditions, created_at`,
      [templateName, category, medicationName, dosage, frequency, duration, instructions, conditions.length > 0 ? conditions : null, auth.userId],
    )

    return NextResponse.json({ template: rows[0] }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating prescription template:", err)
    return NextResponse.json({ error: "Failed to create prescription template" }, { status: 500 })
  }
}

