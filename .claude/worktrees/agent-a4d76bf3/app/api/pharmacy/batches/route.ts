import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

// Get batches for a medication, ordered by FEFO (First Expired First Out)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const medicationId = (url.searchParams.get("medicationId") || "").trim()
    const quantity = Number(url.searchParams.get("quantity") || 0)

    if (!medicationId) {
      return NextResponse.json({ error: "medicationId is required" }, { status: 400 })
    }

    // Get batches ordered by expiry date (FEFO) and received date (FIFO as fallback)
    const { rows: batchRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `
        SELECT mb.id,
               mb.medication_id,
               mb.batch_number,
               mb.quantity,
               mb.expiry_date,
               mb.received_at,
               mb.cost_price,
               m.name AS medication_name
          FROM medication_batches mb
          JOIN medications m ON m.id = mb.medication_id
         WHERE mb.medication_id = $1
           AND mb.quantity > 0
         ORDER BY 
           CASE WHEN mb.expiry_date IS NOT NULL THEN mb.expiry_date ELSE '9999-12-31'::DATE END ASC,
           mb.received_at ASC
      `,
      [medicationId],
    )

    // If no batches exist, return medication-level info for backward compatibility
    if (batchRows.length === 0) {
      const { rows: medRows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT id, name, stock_quantity, expiry_date, batch_number 
         FROM medications 
         WHERE id = $1`,
        [medicationId],
      )

      if (medRows.length === 0) {
        return NextResponse.json({ error: "Medication not found" }, { status: 404 })
      }

      return NextResponse.json({
        batches: [],
        medication: medRows[0],
        availableQuantity: Number(medRows[0].stock_quantity) || 0,
        suggestedBatches: [],
      })
    }

    // Calculate suggested batches for the requested quantity (FEFO)
    const suggestedBatches: Array<{ batchId: string; batchNumber: string; quantity: number; expiryDate: string | null }> = []
    let remainingQty = quantity > 0 ? quantity : 0
    const availableQuantity = batchRows.reduce((sum, b) => sum + Number(b.quantity || 0), 0)

    for (const batch of batchRows) {
      if (remainingQty <= 0) break

      const batchQty = Number(batch.quantity || 0)
      if (batchQty > 0) {
        const takeQty = Math.min(remainingQty, batchQty)
        suggestedBatches.push({
          batchId: batch.id,
          batchNumber: batch.batch_number,
          quantity: takeQty,
          expiryDate: batch.expiry_date,
        })
        remainingQty -= takeQty
      }
    }

    return NextResponse.json({
      batches: batchRows,
      availableQuantity,
      suggestedBatches: quantity > 0 ? suggestedBatches : [],
    })
  } catch (err: any) {
    console.error("Error fetching batches:", err)
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 })
  }
}

// Create or update a batch
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      medicationId?: string
      batchNumber?: string
      quantity?: number
      expiryDate?: string
      costPrice?: number
    }

    const medicationId = (body.medicationId || "").trim()
    const batchNumber = (body.batchNumber || "").trim()
    const quantity = Number(body.quantity ?? 0)
    const expiryDate = body.expiryDate || null
    const costPrice = body.costPrice ? Number(body.costPrice) : null

    if (!medicationId || !batchNumber) {
      return NextResponse.json({ error: "medicationId and batchNumber are required" }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ error: "quantity must be a non-negative number" }, { status: 400 })
    }

    // Check if batch exists
    const { rows: existingRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, quantity FROM medication_batches WHERE medication_id = $1 AND batch_number = $2`,
      [medicationId, batchNumber],
    )

    if (existingRows.length > 0) {
      // Update existing batch
      const existingQty = Number(existingRows[0].quantity || 0)
      const newQty = existingQty + quantity

      await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `UPDATE medication_batches 
         SET quantity = $1, 
             expiry_date = COALESCE($2, expiry_date),
             cost_price = COALESCE($3, cost_price),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newQty, expiryDate, costPrice, existingRows[0].id],
      )

      return NextResponse.json({ ok: true, batchId: existingRows[0].id, quantity: newQty })
    } else {
      // Create new batch
      const { rows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `INSERT INTO medication_batches (
           medication_id,
           batch_number,
           quantity,
           expiry_date,
           cost_price,
           created_by
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, medication_id, batch_number, quantity, expiry_date, received_at`,
        [medicationId, batchNumber, quantity, expiryDate, costPrice, auth.userId],
      )

      return NextResponse.json({ ok: true, batch: rows[0] }, { status: 201 })
    }
  } catch (err: any) {
    console.error("Error creating/updating batch:", err)
    return NextResponse.json({ error: "Failed to create/update batch" }, { status: 500 })
  }
}

// Update batch quantity (for dispensing)
export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      batchId?: string
      quantity?: number
    }

    const batchId = (body.batchId || "").trim()
    const quantity = Number(body.quantity ?? 0)

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ error: "quantity must be a non-negative number" }, { status: 400 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE medication_batches SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [quantity, batchId],
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Error updating batch:", err)
    return NextResponse.json({ error: "Failed to update batch" }, { status: 500 })
  }
}

