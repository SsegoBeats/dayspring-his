import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can, generateReceiptNumber, generateBarcodeData } from "@/lib/security"
import { withSession } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ prescriptionId: string }> }) {
  try {
    const { prescriptionId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "pharmacy", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { witness_name, dispensing_notes } = body

    // ⚠️ HIGHEST-STAKES TRANSACTION: controlled drug audit trail — ALL steps in ONE withSession
    const result = await withSession({ role: auth.role, userId: auth.userId }, async (client) => {
      // 1. Fetch and lock prescription
      // NOTE: prescriptions table has no prescriber_name/prescriber_registration_number columns.
      //       Those fields live on controlled_drug_register directly.
      //       We fetch doctor info via users table for the register entry.
      const { rows: [prescription] } = await client.query(
        `SELECT p.*, m.name AS medication_name_inv, m.stock_quantity, m.is_controlled,
                m.schedule_class, m.id AS medication_id, m.unit_price AS medication_unit_price,
                pat.first_name, pat.last_name,
                u.name AS prescriber_name
           FROM prescriptions p
      LEFT JOIN medications m ON m.name = p.medication_name
      LEFT JOIN patients pat ON pat.id = p.patient_id
      LEFT JOIN users u ON u.id = p.doctor_id
          WHERE p.id = $1 FOR UPDATE`, [prescriptionId]
      )
      if (!prescription) throw Object.assign(new Error("Prescription not found"), { code: "MEDICATION_NOT_FOUND" })
      // prescriptions.status values are 'Pending', 'Dispensed', 'Cancelled' (capitalized)
      if (prescription.status !== "Pending") throw Object.assign(new Error("Prescription already dispensed or cancelled"), { code: "PRESCRIPTION_ALREADY_DISPENSED" })
      // Guard: name-based join may fail if medication name doesn't match exactly
      if (!prescription.medication_id) throw Object.assign(new Error(`Medication "${prescription.medication_name}" not found in inventory. Ensure the medication name matches exactly.`), { code: "MEDICATION_NOT_FOUND" })

      const qty = Number(prescription.quantity) || 1

      // 2. Verify stock (FEFO — earliest expiry batch first)
      const { rows: batches } = await client.query(
        `SELECT * FROM medication_batches
          WHERE medication_id = $1 AND quantity > 0
          ORDER BY expiry_date ASC, received_at ASC`,
        [prescription.medication_id]
      )
      const totalAvailable = batches.reduce((sum: number, b: any) => sum + Number(b.quantity), 0)
      if (totalAvailable < qty) {
        throw Object.assign(new Error(`Insufficient stock. Available: ${totalAvailable}, Required: ${qty}`), { code: "INSUFFICIENT_STOCK" })
      }

      // Deduct from batches in FEFO order
      let remaining = qty
      const usedBatches: { id: string; batch_number: string; expiry_date: string; qty: number }[] = []
      for (const batch of batches) {
        if (remaining <= 0) break
        const deduct = Math.min(remaining, Number(batch.quantity))
        await client.query(`UPDATE medication_batches SET quantity = quantity - $1 WHERE id = $2`, [deduct, batch.id])
        usedBatches.push({ id: batch.id, batch_number: batch.batch_number, expiry_date: batch.expiry_date, qty: deduct })
        remaining -= deduct
      }
      const primaryBatch = usedBatches[0]

      // 3. Update prescription status — 'Dispensed' (capitalized, per CHECK constraint)
      await client.query(
        `UPDATE prescriptions SET status = 'Dispensed', dispensed_at = now(), dispensed_by = $1 WHERE id = $2`,
        [auth.userId, prescriptionId]
      )

      // 4. Deduct medication stock total
      await client.query(
        `UPDATE medications SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [qty, prescription.medication_id]
      )

      // 5. Insert stock movement — 'Dispense' (capitalized, per CHECK constraint)
      await client.query(
        `INSERT INTO medication_stock_movements (medication_id, movement_type, quantity, reference, batch_number, expiry_date, created_by)
         VALUES ($1, 'Dispense', $2, $3, $4, $5, $6)`,
        [prescription.medication_id, qty, prescriptionId, primaryBatch?.batch_number, primaryBatch?.expiry_date, auth.userId]
      )

      // 6. Controlled drug register (if is_controlled)
      if (prescription.is_controlled) {
        // Compute running balance from all prior entries (server-side — never trust client)
        const { rows: [balanceRow] } = await client.query(
          `SELECT
             COALESCE(SUM(CASE WHEN entry_type IN ('receipt','opening_balance') THEN quantity_dispensed ELSE -quantity_dispensed END), 0) AS computed_balance,
             COALESCE((SELECT running_balance FROM controlled_drug_register WHERE medication_id = $1 ORDER BY dispensed_at DESC LIMIT 1), 0) AS last_stored_balance
           FROM controlled_drug_register WHERE medication_id = $1`,
          [prescription.medication_id]
        )
        // Integrity check: computed must match last stored (NDA compliance requirement)
        if (balanceRow.last_stored_balance !== 0 && Number(balanceRow.computed_balance) !== Number(balanceRow.last_stored_balance)) {
          throw Object.assign(
            new Error("Controlled drug register balance mismatch — dispense blocked for safety. Contact Hospital Admin."),
            { code: "CONTROLLED_DRUG_BALANCE_MISMATCH" }
          )
        }
        const newBalance = Number(balanceRow.computed_balance) - qty
        // prescriptions table has no prescriber_name/prescriber_registration_number columns;
        // use doctor's name fetched via users join above (u.name AS prescriber_name), and null for registration number.
        await client.query(
          `INSERT INTO controlled_drug_register
           (medication_id, patient_id, prescription_id, prescriber_name, prescriber_registration_number,
            quantity_dispensed, batch_number, running_balance, dispensed_by, witness_name, entry_type, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'dispense',$11)`,
          [
            prescription.medication_id, prescription.patient_id, prescriptionId,
            prescription.prescriber_name || "Unknown", null,
            qty, primaryBatch?.batch_number, newBalance, auth.userId,
            witness_name || null, dispensing_notes || null
          ]
        )
      }

      return { prescription, primaryBatch, usedBatches, qty }
    })

    // 7. Post-transaction: low-stock notification + inpatient/emergency auto-billing
    try {
      const { query } = await import("@/lib/db")

      // Low-stock check
      const { rows: [med] } = await query(
        `SELECT stock_quantity, reorder_level, name, unit_price FROM medications WHERE id = $1`,
        [result.prescription.medication_id]
      )
      if (med && Number(med.stock_quantity) <= Number(med.reorder_level)) {
        await query(
          `INSERT INTO notifications (department, role, title, message, type, priority, payload)
           VALUES ($1, $2, $3, $4, 'pharmacy_low_stock', 'High', $5::jsonb)`,
          [
            "pharmacy",
            "Pharmacist",
            "Low Stock Alert",
            `${med.name} is below reorder level (${med.stock_quantity} remaining)`,
            JSON.stringify({ medicationId: result.prescription.medication_id, medicationName: med.name, initialTab: "inventory" })
          ]
        )
      }

      // Inpatient/Emergency: auto-create bill for later cashier collection
      const visitType: string = result.prescription.visit_type || "OPD"
      if (visitType === "INPATIENT" || visitType === "EMERGENCY") {
        const unitPrice = med ? Number(med.unit_price) || 0 : 0
        const totalPrice = unitPrice * result.qty
        const billNumber = generateReceiptNumber()
        const { rows: [pat] } = await query(
          `SELECT first_name, last_name FROM patients WHERE id = $1`,
          [result.prescription.patient_id]
        )
        const patientName = pat ? `${pat.first_name || ""} ${pat.last_name || ""}`.trim() : "Patient"

        const billInsert = await query(
          `INSERT INTO bills (bill_number, patient_id, total_amount, tax_amount, discount_amount,
                              final_amount, status, payment_method, paid_amount, barcode, cashier_id,
                              prescription_id)
           VALUES ($1,$2,$3,0,0,$3,'Pending',NULL,0,NULL,NULL,$4)
           RETURNING id`,
          [billNumber, result.prescription.patient_id, totalPrice, prescriptionId]
        )
        const billId = billInsert.rows[0].id as string

        const barcodePayload = generateBarcodeData("payment", billId, {
          patientId: result.prescription.patient_id,
          source: "prescription",
          items: [{ d: result.prescription.medication_name_inv?.slice(0, 40), q: result.qty, u: unitPrice, t: totalPrice }],
        })
        await query(`UPDATE bills SET barcode = $1 WHERE id = $2`, [barcodePayload, billId])

        await query(
          `INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [billId, result.prescription.medication_name_inv || result.prescription.medication_name, result.qty, unitPrice, totalPrice]
        )

        // Notify cashier
        await query(
          `INSERT INTO notifications (user_id, department, role, title, message, type, priority, payload)
           VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`,
          [
            "cashier",
            "Cashier",
            `${visitType === "EMERGENCY" ? "Emergency" : "Inpatient"} medication dispensed`,
            `${result.prescription.medication_name_inv || result.prescription.medication_name} dispensed for ${patientName} — collect payment`,
            "Payment",
            visitType === "EMERGENCY" ? "High" : "Normal",
            JSON.stringify({ billId, patientId: result.prescription.patient_id, billNumber, prescriptionId, source: "prescription" }),
          ]
        )
      }
    } catch (postErr) {
      console.error("Post-dispense notifications/billing failed (non-fatal):", postErr)
    } // Never fail the dispense response over post-transaction work

    return NextResponse.json({ success: true, prescription_id: prescriptionId })
  } catch (err: any) {
    console.error("Dispense transaction failed:", err)
    const code = err.code || "TRANSACTION_FAILED"
    const status = code === "PRESCRIPTION_ALREADY_DISPENSED" ? 409
      : code === "INSUFFICIENT_STOCK" ? 422
      : code === "MEDICATION_NOT_FOUND" ? 404
      : 500
    return NextResponse.json({
      error: err.message || "Dispensing failed — no changes were made. Please try again or contact support.",
      code
    }, { status })
  }
}
