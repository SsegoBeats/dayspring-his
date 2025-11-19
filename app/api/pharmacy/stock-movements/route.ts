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
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const medicationId = (url.searchParams.get("medicationId") || "").trim()
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500)

    const params: any[] = []
    let where = ""
    if (medicationId) {
      where = "WHERE msm.medication_id = $1"
      params.push(medicationId)
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT msm.id,
               msm.medication_id,
               m.name AS medication_name,
               msm.movement_type,
               msm.quantity,
               msm.reference,
               msm.batch_number,
               msm.expiry_date,
               msm.barcode_snapshot,
               msm.created_at,
               u.name AS created_by_name
          FROM medication_stock_movements msm
          JOIN medications m ON m.id = msm.medication_id
          LEFT JOIN users u ON u.id = msm.created_by
          ${where}
         ORDER BY msm.created_at DESC
         LIMIT ${limit}
      `,
      params,
    )

    return NextResponse.json({ movements: rows })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 })
  }
}

