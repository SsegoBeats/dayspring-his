import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { ORG_NAME, ORG_ADDRESS, ORG_PHONE, ORG_EMAIL } from "@/lib/org-constants"
import PDFDocument from "pdfkit"

interface DischargeData {
  patient: {
    id: string
    name: string
    patientNumber: string
    dateOfBirth: string
    gender: string
    phone: string
  }
  visit: {
    admissionDate: string
    dischargeDate: string
    ward?: string
    clinic?: string
    attendingClinician: string
  }
  diagnoses: Array<{ code?: string; description: string }>
  prescriptions: Array<{
    medication: string
    dosage: string
    frequency: string
    duration: string
    instructions?: string
  }>
  procedures: Array<{ name: string; date: string }>
  notes: string[]
  dischargeInstructions: string
}

export async function POST(req: Request) {
  try {
    // Authorization check
    const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] || 
                  req.headers.get("cookie")?.match(/session_dev=([^;]+)/)?.[1]
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !['Clinician', 'Hospital Admin'].includes(payload.role)) {
      return NextResponse.json({ 
        error: "Only Clinicians and Hospital Admins can export discharge summaries" 
      }, { status: 403 })
    }

    const body = await req.json()
    const { patientId, visitId, type } = body

    if (!patientId) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 })
    }

    // Fetch patient data
    const patientResult = await query<{
      id: string
      patient_number: string
      first_name: string
      last_name: string
      date_of_birth: string
      gender: string
      phone: string
    }>(
      `SELECT id, patient_number, first_name, last_name, date_of_birth, gender, phone 
       FROM patients WHERE id = $1`,
      [patientId]
    )

    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const patient = patientResult.rows[0]

    // Fetch visit/encounter data
    const encounterResult = await query<{
      id: string
      started_at: string
      ended_at: string
      type: string
    }>(
      visitId
        ? `SELECT id, started_at, ended_at, type FROM "Encounter" WHERE id = $1 AND "patientId" = $2`
        : `SELECT id, started_at, ended_at, type FROM "Encounter" 
           WHERE "patientId" = $1 AND status = 'DISCHARGED' 
           ORDER BY started_at DESC LIMIT 1`,
      visitId ? [visitId, patientId] : [patientId]
    )

    const encounter = encounterResult.rows[0]
    if (!encounter) {
      return NextResponse.json({ error: "No discharge visit found" }, { status: 404 })
    }

    // Fetch medical records (diagnoses and notes)
    const medicalResult = await query<{
      diagnosis: string
      treatment_plan: string
      notes: string
      visit_date: string
      doctor_name: string
    }>(
      `SELECT mr.diagnosis, mr.treatment_plan, mr.notes, mr.visit_date, u.name as doctor_name
       FROM medical_records mr
       LEFT JOIN users u ON mr.doctor_id = u.id
       WHERE mr.patient_id = $1
       ORDER BY mr.visit_date DESC`,
      [patientId]
    )

    // Fetch prescriptions
    const prescriptionResult = await query<{
      medication_name: string
      dosage: string
      frequency: string
      duration: string
      instructions: string
      created_at: string
    }>(
      `SELECT medication_name, dosage, frequency, duration, instructions, created_at
       FROM prescriptions
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    )

    // Fetch procedures
    const procedureResult = await query<{
      procedure_name: string
      completed_at: string
    }>(
      `SELECT procedure_name, completed_at
       FROM procedures
       WHERE patient_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC`,
      [patientId]
    )

    // Fetch clinician name for attending
    const clinicianResult = await query<{ name: string }>(
      `SELECT u.name FROM users u
       INNER JOIN medical_records mr ON mr.doctor_id = u.id
       WHERE mr.patient_id = $1
       ORDER BY mr.visit_date DESC LIMIT 1`,
      [patientId]
    )

    // Build discharge data
    const dischargeData: DischargeData = {
      patient: {
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        patientNumber: patient.patient_number,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone || 'N/A',
      },
      visit: {
        admissionDate: encounter.started_at,
        dischargeDate: encounter.ended_at || new Date().toISOString(),
        ward: type === 'inpatient' ? 'General Ward' : undefined,
        clinic: type === 'opd' ? 'OPD' : undefined,
        attendingClinician: clinicianResult.rows[0]?.name || 'Not recorded',
      },
      diagnoses: medicalResult.rows
        .map(r => ({ description: r.diagnosis || 'Not specified' }))
        .filter(d => d.description && d.description !== 'Not specified'),
      prescriptions: prescriptionResult.rows.map(p => ({
        medication: p.medication_name,
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
        instructions: p.instructions || '',
      })),
      procedures: procedureResult.rows.map(p => ({
        name: p.procedure_name,
        date: p.completed_at,
      })),
      notes: medicalResult.rows.map(r => r.notes).filter(Boolean),
      dischargeInstructions: medicalResult.rows[0]?.treatment_plan || 'Follow up as needed',
    }

    // Generate PDF
    const pdfBuffer = await generateDischargePDF(dischargeData)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="discharge-summary-${patient.patient_number}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('[discharge-export] Error:', error)
    return NextResponse.json({ error: error?.message || 'Export failed' }, { status: 500 })
  }
}

async function generateDischargePDF(data: DischargeData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(ORG_NAME, { align: 'center' })
    doc.fontSize(10).font('Helvetica').text(ORG_ADDRESS, { align: 'center' })
    doc.text(`${ORG_PHONE} | ${ORG_EMAIL}`, { align: 'center' })
    doc.moveDown()
    doc.fontSize(16).font('Helvetica-Bold').text('DISCHARGE SUMMARY', { align: 'center' })
    doc.moveDown(2)

    // Patient Information
    doc.fontSize(12).font('Helvetica-Bold').text('Patient Information')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Name: ${data.patient.name}`)
    doc.text(`Patient Number: ${data.patient.patientNumber}`)
    doc.text(`Date of Birth: ${new Date(data.patient.dateOfBirth).toLocaleDateString()}`)
    doc.text(`Gender: ${data.patient.gender}`)
    doc.text(`Phone: ${data.patient.phone}`)
    doc.moveDown()

    // Visit Details
    doc.fontSize(12).font('Helvetica-Bold').text('Visit Details')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Admission Date: ${new Date(data.visit.admissionDate).toLocaleString()}`)
    doc.text(`Discharge Date: ${new Date(data.visit.dischargeDate).toLocaleString()}`)
    if (data.visit.ward) doc.text(`Ward: ${data.visit.ward}`)
    if (data.visit.clinic) doc.text(`Clinic: ${data.visit.clinic}`)
    doc.text(`Attending Clinician: ${data.visit.attendingClinician}`)
    doc.moveDown()

    // Diagnoses
    if (data.diagnoses.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Diagnoses')
      doc.fontSize(10).font('Helvetica')
      data.diagnoses.forEach((d, i) => {
        doc.text(`${i + 1}. ${d.code ? `[${d.code}] ` : ''}${d.description}`)
      })
      doc.moveDown()
    }

    // Prescriptions
    if (data.prescriptions.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Medications Prescribed')
      doc.fontSize(10).font('Helvetica')
      data.prescriptions.forEach((p, i) => {
        doc.text(`${i + 1}. ${p.medication}`)
        doc.text(`   Dosage: ${p.dosage}, Frequency: ${p.frequency}, Duration: ${p.duration}`, { indent: 20 })
        if (p.instructions) doc.text(`   Instructions: ${p.instructions}`, { indent: 20 })
      })
      doc.moveDown()
    }

    // Procedures
    if (data.procedures.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Procedures Performed')
      doc.fontSize(10).font('Helvetica')
      data.procedures.forEach((p, i) => {
        doc.text(`${i + 1}. ${p.name} (${new Date(p.date).toLocaleDateString()})`)
      })
      doc.moveDown()
    }

    // Clinical Notes
    if (data.notes.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Clinical Notes')
      doc.fontSize(10).font('Helvetica')
      data.notes.forEach(note => {
        doc.text(`• ${note}`)
      })
      doc.moveDown()
    }

    // Discharge Instructions
    doc.fontSize(12).font('Helvetica-Bold').text('Discharge Instructions')
    doc.fontSize(10).font('Helvetica')
    doc.text(data.dischargeInstructions || 'Follow up with your clinician as scheduled.')
    doc.moveDown(2)

    // Footer
    doc.fontSize(8).text(
      `Generated on ${new Date().toLocaleString()} | ${ORG_NAME}`,
      { align: 'center' }
    )

    doc.end()
  })
}
