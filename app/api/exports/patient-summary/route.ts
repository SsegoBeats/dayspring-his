import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { ORG_NAME, ORG_ADDRESS, ORG_PHONE, ORG_EMAIL } from "@/lib/org-constants"
import { z } from "zod"
import PDFDocument from "pdfkit"

const CreateSummarySchema = z.object({
  patientId: z.string().uuid(),
  visitId: z.string().uuid(),
  type: z.enum(["avs", "discharge"]),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload || !["Clinician", "Hospital Admin"].includes(payload.role)) {
      return NextResponse.json({ error: "Only Clinicians and Hospital Admins can generate summaries" }, { status: 403 })
    }

    const body = await req.json()
    const { patientId, visitId, type } = CreateSummarySchema.parse(body)

    // Check if a printed summary already exists for this visit (cannot regenerate)
    const existingResult = await query<{ id: string; status: string }>(
      `SELECT id, status FROM patient_summaries WHERE visit_id = $1 AND status IN ('pending_print', 'printed') LIMIT 1`,
      [visitId]
    )
    if (existingResult.rows.length > 0 && existingResult.rows[0].status === "printed") {
      return NextResponse.json({ error: "A finalized summary already exists for this visit. Contact an admin to unlock it." }, { status: 409 })
    }

    // Fetch patient
    const patientRes = await query<{
      id: string; patient_number: string; first_name: string; last_name: string
      date_of_birth: string; gender: string; phone: string
    }>(`SELECT id, patient_number, first_name, last_name, date_of_birth, gender, phone FROM patients WHERE id = $1`, [patientId])
    if (!patientRes.rows[0]) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    const patient = patientRes.rows[0]

    // Fetch medical record (the visit anchor)
    const recordRes = await query<{
      id: string; visit_date: string; chief_complaint: string | null; history: string | null
      impression: string | null; diagnosis: string | null; treatment_plan: string | null; notes: string | null
      doctor_name: string | null
    }>(
      `SELECT mr.id, mr.visit_date, mr.chief_complaint, mr.history, mr.impression, mr.diagnosis, mr.treatment_plan, mr.notes,
              u.name AS doctor_name
       FROM medical_records mr
       LEFT JOIN users u ON u.id = mr.doctor_id
       WHERE mr.id = $1 AND mr.patient_id = $2`,
      [visitId, patientId]
    )
    if (!recordRes.rows[0]) return NextResponse.json({ error: "Visit record not found" }, { status: 404 })
    const record = recordRes.rows[0]

    // Fetch latest vitals on visit day
    const visitDate = new Date(record.visit_date)
    const dayStart = new Date(visitDate); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(visitDate); dayEnd.setHours(23, 59, 59, 999)

    const vitalsRes = await query<{
      blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null
      temperature: number | null; heart_rate: number | null; recorded_at: string
    }>(
      `SELECT blood_pressure_systolic, blood_pressure_diastolic, temperature, heart_rate, recorded_at
       FROM vital_signs
       WHERE patient_id = $1 AND recorded_at BETWEEN $2 AND $3
       ORDER BY recorded_at DESC LIMIT 1`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )
    const vitals = vitalsRes.rows[0] ?? null

    // Fetch prescriptions created on visit day
    const rxRes = await query<{
      medication_name: string; dosage: string; frequency: string
      duration: string; instructions: string | null; administration_guidance: string | null
    }>(
      `SELECT medication_name, dosage, frequency, duration, instructions, administration_guidance
       FROM prescriptions
       WHERE patient_id = $1 AND created_at BETWEEN $2 AND $3
       ORDER BY created_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    // Fetch lab tests ordered on visit day
    const labRes = await query<{
      test_name: string; status: string; results: string | null
    }>(
      `SELECT test_name, status, results
       FROM lab_tests
       WHERE patient_id = $1 AND ordered_at BETWEEN $2 AND $3
       ORDER BY ordered_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    // Fetch nursing notes for visit day
    const notesRes = await query<{
      note: string; note_type: string; created_at: string; nurse_name: string | null
    }>(
      `SELECT nn.note, nn.note_type, nn.created_at, u.name AS nurse_name
       FROM nursing_notes nn
       LEFT JOIN users u ON u.id = nn.nurse_id
       WHERE nn.patient_id = $1 AND nn.created_at BETWEEN $2 AND $3
       ORDER BY nn.created_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    // Fetch billing for visit day
    const billRes = await query<{
      bill_number: string; final_amount: number; status: string
    }>(
      `SELECT bill_number, final_amount, status
       FROM bills
       WHERE patient_id = $1 AND created_at BETWEEN $2 AND $3
       ORDER BY created_at DESC LIMIT 1`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    const billItemsRes = billRes.rows[0]
      ? await query<{ description: string; quantity: number; unit_price: number; total_price: number }>(
          `SELECT description, quantity, unit_price, total_price FROM bill_items
           WHERE bill_id = (SELECT id FROM bills WHERE patient_id = $1 AND created_at BETWEEN $2 AND $3 ORDER BY created_at DESC LIMIT 1)
           ORDER BY created_at ASC`,
          [patientId, dayStart.toISOString(), dayEnd.toISOString()]
        )
      : { rows: [] }

    // Generate PDF
    const pdfBuffer = await generateSummaryPDF({
      type,
      patient: {
        name: `${patient.first_name} ${patient.last_name}`,
        patientNumber: patient.patient_number,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
      },
      record: {
        visitDate: record.visit_date,
        chiefComplaint: record.chief_complaint,
        history: record.history,
        impression: record.impression,
        diagnosis: record.diagnosis,
        treatmentPlan: record.treatment_plan,
        notes: record.notes,
        doctorName: record.doctor_name,
      },
      vitals,
      prescriptions: rxRes.rows,
      labTests: labRes.rows,
      nursingNotes: notesRes.rows,
      bill: billRes.rows[0] ?? null,
      billItems: billItemsRes.rows,
    })

    // Store in DB (upsert: replace pending if re-generating before print)
    const existingId = existingResult.rows[0]?.id
    let savedId: string

    if (existingId) {
      await query(
        `UPDATE patient_summaries SET pdf_data = $1, generated_by = $2, generated_at = now(), status = 'pending_print' WHERE id = $3`,
        [pdfBuffer, payload.sub, existingId]
      )
      savedId = existingId
    } else {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO patient_summaries (patient_id, visit_id, visit_type, generated_by, pdf_data)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [patientId, visitId, type, payload.sub, pdfBuffer]
      )
      savedId = insertRes.rows[0].id
    }

    // Audit log
    await writeAuditLog({
      userId: payload.sub,
      action: "SUMMARY_GENERATED",
      entityType: "PatientSummary",
      entityId: savedId,
      details: { patientId, visitId, type, category: "CLINICAL" },
    })

    // Notify Hospital Admins (best-effort)
    const adminRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'Hospital Admin' AND is_active = true`
    )
    for (const admin of adminRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          admin.id,
          "Patient summary ready to print",
          `${patient.first_name} ${patient.last_name} (${patient.patient_number}) — ${type === "avs" ? "After-Visit Summary" : "Discharge Summary"}`,
          "info",
          "PatientSummary",
          savedId,
        ]
      ).catch(() => {})
    }

    return NextResponse.json({ id: savedId, status: "pending_print" })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate summary"
    console.error("[patient-summary POST]", error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload || payload.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Only Hospital Admins can view the print queue" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? "pending_print"

    const result = await query<{
      id: string; patient_id: string; visit_type: string; generated_at: string; status: string
      patient_name: string; patient_number: string; doctor_name: string | null
    }>(
      `SELECT ps.id, ps.patient_id, ps.visit_type, ps.generated_at, ps.status,
              TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
              p.patient_number,
              u.name AS doctor_name
       FROM patient_summaries ps
       JOIN patients p ON p.id = ps.patient_id
       LEFT JOIN users u ON u.id = ps.generated_by
       WHERE ps.status = $1
       ORDER BY ps.generated_at DESC
       LIMIT 100`,
      [status]
    )
    return NextResponse.json({ summaries: result.rows })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch summaries"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// --- PDF generation ---

interface SummaryData {
  type: "avs" | "discharge"
  patient: { name: string; patientNumber: string; dateOfBirth: string; gender: string; phone: string }
  record: {
    visitDate: string; chiefComplaint: string | null; history: string | null
    impression: string | null; diagnosis: string | null; treatmentPlan: string | null
    notes: string | null; doctorName: string | null
  }
  vitals: {
    blood_pressure_systolic: number | null
    blood_pressure_diastolic: number | null
    temperature: number | null
    heart_rate: number | null
  } | null
  prescriptions: Array<{
    medication_name: string; dosage: string; frequency: string
    duration: string; instructions: string | null; administration_guidance: string | null
  }>
  labTests: Array<{ test_name: string; status: string; results: string | null }>
  nursingNotes: Array<{ note: string; note_type: string; created_at: string; nurse_name: string | null }>
  bill: { bill_number: string; final_amount: number; status: string } | null
  billItems: Array<{ description: string; quantity: number; unit_price: number; total_price: number }>
}

async function generateSummaryPDF(data: SummaryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" })
    const chunks: Buffer[] = []
    doc.on("data", (c: Buffer) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const title = data.type === "avs" ? "After-Visit Summary" : "Discharge Summary"
    const visitDate = new Date(data.record.visitDate).toLocaleDateString("en-UG", {
      day: "2-digit", month: "long", year: "numeric",
    })

    // Header
    doc.fontSize(16).font("Helvetica-Bold").text(ORG_NAME, { align: "center" })
    doc.fontSize(9).font("Helvetica").text(ORG_ADDRESS, { align: "center" })
    doc.text(ORG_PHONE, { align: "center" })
    doc.text(ORG_EMAIL, { align: "center" })
    doc.text("Mon-Sat: 8:00am – 8:00pm  |  Sun: 2:00pm – 6pm", { align: "center" })
    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)
    doc.fontSize(12).font("Helvetica-Bold").text(title, { align: "center" })
    doc.moveDown()

    // Patient info grid
    const col1x = 50, col2x = 300
    const bpText = data.vitals?.blood_pressure_systolic && data.vitals?.blood_pressure_diastolic
      ? `${data.vitals.blood_pressure_systolic}/${data.vitals.blood_pressure_diastolic} mmHg`
      : "Not recorded"
    const age = data.patient.dateOfBirth
      ? String(new Date().getFullYear() - new Date(data.patient.dateOfBirth).getFullYear()) + " yrs"
      : "N/A"

    const lineH = 16
    const startY = doc.y
    doc.fontSize(10).font("Helvetica-Bold").text("OPD No:", col1x, startY).font("Helvetica").text(data.patient.patientNumber, col1x + 60, startY)
    doc.font("Helvetica-Bold").text("Patient Name:", col2x, startY).font("Helvetica").text(data.patient.name, col2x + 90, startY)
    doc.font("Helvetica-Bold").text("Sex:", col1x, startY + lineH).font("Helvetica").text(data.patient.gender, col1x + 60, startY + lineH)
    doc.font("Helvetica-Bold").text("Age:", col2x, startY + lineH).font("Helvetica").text(age, col2x + 90, startY + lineH)
    doc.font("Helvetica-Bold").text("BP:", col1x, startY + lineH * 2).font("Helvetica").text(bpText, col1x + 60, startY + lineH * 2)
    doc.font("Helvetica-Bold").text("Visit Date:", col2x, startY + lineH * 2).font("Helvetica").text(visitDate, col2x + 90, startY + lineH * 2)
    doc.moveDown(3)

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown()

    // Clinical narrative
    if (data.record.chiefComplaint) {
      const genderWord = data.patient.gender === "M" ? "male" : data.patient.gender === "F" ? "female" : ""
      doc.fontSize(10).font("Helvetica")
        .text(`Received a ${genderWord} patient complaining of ${data.record.chiefComplaint}.`)
      doc.moveDown(0.5)
    }
    if (data.record.history) {
      doc.font("Helvetica-Bold").text("PmHx:", { continued: true }).font("Helvetica").text("  " + data.record.history)
      doc.moveDown(0.5)
    }
    if (data.record.notes) {
      doc.font("Helvetica-Bold").text("O/E:", { continued: true }).font("Helvetica").text("  " + data.record.notes)
      doc.moveDown(0.5)
    }
    if (data.record.impression) {
      doc.font("Helvetica-Bold").text("Impression:", { continued: true }).font("Helvetica").text("  " + data.record.impression)
      doc.moveDown()
    }

    // Lab tests
    if (data.labTests.length > 0) {
      doc.font("Helvetica-Bold").text("Investigations:")
      data.labTests.forEach((lt) => {
        const result = lt.results ? ` — ${lt.results}` : lt.status === "completed" ? " — See report" : " — Pending"
        doc.font("Helvetica").text(`  • ${lt.test_name}${result}`)
      })
      doc.moveDown()
    }

    // Prescriptions table
    if (data.prescriptions.length > 0) {
      doc.font("Helvetica-Bold").text("Treatment Given:").moveDown(0.3)
      const rxColDrug = 50, rxColQty = 380
      doc.font("Helvetica-Bold").fontSize(9).text("Drug / Route", rxColDrug, doc.y)
      doc.text("QTY / Duration", rxColQty, doc.y - doc.currentLineHeight())
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      data.prescriptions.forEach((rx) => {
        const drugText = rx.administration_guidance
          ? `${rx.medication_name} (${rx.administration_guidance})`
          : rx.medication_name
        const qtyText = `${rx.dosage} ${rx.frequency} × ${rx.duration}`
        const rowY = doc.y
        doc.font("Helvetica").fontSize(9).text(drugText, rxColDrug, rowY, { width: 310 })
        doc.text(qtyText, rxColQty, rowY, { width: 160 })
        if (rx.instructions) {
          doc.fillColor("#555").text(`  Instructions: ${rx.instructions}`, rxColDrug, doc.y, { width: 490 }).fillColor("black")
        }
      })
      doc.moveDown()
    }

    // Nursing notes
    if (data.nursingNotes.length > 0) {
      doc.font("Helvetica-Bold").text("Nursing Notes:").font("Helvetica")
      data.nursingNotes.forEach((n) => {
        const time = new Date(n.created_at).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })
        doc.text(`  [${time}] ${n.nurse_name ?? "Nurse"}: ${n.note}`)
      })
      doc.moveDown()
    }

    // Billing summary
    if (data.bill && data.billItems.length > 0) {
      doc.font("Helvetica-Bold").text("Billing Summary:").moveDown(0.3)
      data.billItems.forEach((item) => {
        const rowY = doc.y
        doc.font("Helvetica").fontSize(9)
          .text(`  ${item.description}`, 50, rowY, { width: 360 })
          .text(`UGX ${Number(item.total_price).toLocaleString()}`, 420, rowY, { width: 120, align: "right" })
      })
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      const totalY = doc.y + 2
      doc.font("Helvetica-Bold").fontSize(9)
        .text("  Total:", 50, totalY, { width: 360 })
        .text(`UGX ${Number(data.bill.final_amount).toLocaleString()}`, 420, totalY, { width: 120, align: "right" })
      doc.moveDown()
    }

    // TCA / discharge instructions
    if (data.record.treatmentPlan) {
      doc.font("Helvetica-Bold").text("Review TCA / Discharge Instructions:")
      doc.font("Helvetica").text(data.record.treatmentPlan)
      doc.moveDown()
    }

    // Doctor signature
    doc.moveDown()
    doc.font("Helvetica-Bold").text("Doctor's Name: ", { continued: true })
      .font("Helvetica").text(data.record.doctorName ?? "________________________")
    doc.moveDown(0.5)
    doc.text(`Sign: ________________________        Date: ${visitDate}`)
    doc.moveDown(2)

    // Footer
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)
    doc.fontSize(10).font("Helvetica-Oblique").text('"Together with the Healer"', { align: "center" })
    doc.fontSize(8).font("Helvetica").fillColor("#888")
      .text(`Generated ${new Date().toLocaleString()} | ${ORG_NAME}`, { align: "center" })

    doc.end()
  })
}
