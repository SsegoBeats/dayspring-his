import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { withSession } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      medicationId?: string
      quantity?: number
      batchNumber?: string
      expiryDate?: string
      reference?: string
      barcode?: string
    }

    const medicationId = (body.medicationId || "").trim()
    const qty = Number(body.quantity ?? 0)
    if (!medicationId) {
      return NextResponse.json({ error: "medicationId is required" }, { status: 400 })
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 })
    }

    const batchNumber = body.batchNumber ? String(body.batchNumber).trim() || null : null
    const expiryDate = body.expiryDate || null
    const reference = body.reference ? String(body.reference).trim() || null : null
    const barcodeSnapshot = body.barcode ? String(body.barcode).trim() || null : null

    const updatedMedication = await withSession(
      { role: auth.role, userId: auth.userId },
      async (client) => {
        const { rows } = await client.query(
          `UPDATE medications
             SET stock_quantity = stock_quantity + $1,
                 last_restocked_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING id, stock_quantity`,
          [qty, medicationId],
        )

        if (!rows.length) {
          throw new Error("Medication not found")
        }

        await client.query(
          `INSERT INTO medication_stock_movements (
             medication_id,
             movement_type,
             quantity,
             reference,
             batch_number,
             expiry_date,
             barcode_snapshot,
             created_by
           ) VALUES ($1,'Receive',$2,$3,$4,$5,$6,$7)`,
          [medicationId, qty, reference, batchNumber, expiryDate, barcodeSnapshot, auth.userId],
        )

        return rows[0]
      },
    )

    return NextResponse.json({ ok: true, medication: updatedMedication })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to record stock receipt" }, { status: 500 })
  }
}

