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

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      medicationId?: string
      movementType?: string
      quantity?: number
      reference?: string
      batchNumber?: string
      expiryDate?: string
      barcode?: string
    }

    const medicationId = (body.medicationId || "").trim()
    const movementType = body.movementType || "Dispense"
    const quantity = Number(body.quantity ?? 0)
    const reference = body.reference ? String(body.reference).trim() || null : null
    const batchNumber = body.batchNumber ? String(body.batchNumber).trim() || null : null
    const expiryDate = body.expiryDate || null
    const barcodeSnapshot = body.barcode ? String(body.barcode).trim() || null : null

    if (!medicationId) {
      return NextResponse.json({ error: "medicationId is required" }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 })
    }
    if (!["Receive", "Adjust", "Dispense", "Return"].includes(movementType)) {
      return NextResponse.json({ error: "Invalid movementType" }, { status: 400 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO medication_stock_movements (
         medication_id,
         movement_type,
         quantity,
         reference,
         batch_number,
         expiry_date,
         barcode_snapshot,
         created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [medicationId, movementType, quantity, reference, batchNumber, expiryDate, barcodeSnapshot, auth.userId],
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Error recording stock movement:", err)
    return NextResponse.json({ error: "Failed to record stock movement" }, { status: 500 })
  }
}
