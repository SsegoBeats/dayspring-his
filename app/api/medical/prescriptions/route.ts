import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"

// Validation logic (shared with validation endpoint)
async function validatePrescription(
  patientId: string,
  medications: Array<{ name?: string; dosage?: string; frequency?: string; duration?: string }>,
  auth: { role: string; userId: string },
): Promise<Array<{ type: string; severity: "Critical" | "Warning" | "Info"; message: string; medicationName?: string; relatedMedication?: string }>> {
  const validations: Array<{
    type: string
    severity: "Critical" | "Warning" | "Info"
    message: string
    medicationName?: string
    relatedMedication?: string
  }> = []

  try {
    // Get patient information
    const { rows: patientRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, first_name, last_name, date_of_birth, gender, allergies, blood_group 
       FROM patients WHERE id = $1`,
      [patientId],
    )

    if (patientRows.length === 0) return validations

    const patient = patientRows[0]
    const patientAge = patient.date_of_birth
      ? Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null
    const allergies = patient.allergies ? String(patient.allergies).toLowerCase() : ""

    // Get patient's active medications
    const { rows: activeMedsRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT * FROM get_patient_active_medications($1)`,
      [patientId],
    )

    const activeMedications = activeMedsRows.map((r) => String(r.medication_name).toLowerCase())

    // Validate each medication
    for (const med of medications) {
      const medName = (med.name || "").trim()
      if (!medName) continue

      const medNameLower = medName.toLowerCase()

      // Check for allergies
      if (allergies && allergies.includes(medNameLower)) {
        validations.push({
          type: "Allergy",
          severity: "Critical",
          message: `Patient has known allergy to ${medName}. Prescription should not be dispensed.`,
          medicationName: medName,
        })
      }

      // Check for duplicate active prescriptions
      if (activeMedications.includes(medNameLower)) {
        const { rows: dupRows } = await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `SELECT * FROM check_duplicate_prescription($1, $2, 30)`,
          [patientId, medName],
        )

        if (dupRows.length > 0) {
          validations.push({
            type: "Duplicate",
            severity: "Warning",
            message: `Patient already has an active prescription for ${medName} within the last 30 days. Verify if this is a refill or new prescription.`,
            medicationName: medName,
          })
        }
      }

      // Check for drug interactions
      for (const activeMed of activeMedications) {
        const { rows: interactionRows } = await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `SELECT interaction_type, severity, description, clinical_significance, management_advice
           FROM drug_interactions
           WHERE (LOWER(medication1) = $1 AND LOWER(medication2) = $2)
              OR (LOWER(medication1) = $2 AND LOWER(medication2) = $1)`,
          [medNameLower, activeMed],
        )

        for (const interaction of interactionRows) {
          const severity = interaction.severity === "Critical" ? "Critical" : interaction.severity === "Warning" ? "Warning" : "Info"
          validations.push({
            type: "DrugInteraction",
            severity,
            message: `${interaction.description || `Potential ${interaction.interaction_type} interaction between ${medName} and ${activeMed}`}. ${interaction.clinical_significance || ""} ${interaction.management_advice || ""}`,
            medicationName: medName,
            relatedMedication: activeMed,
          })
        }
      }

      // Check for drug interactions within the new prescription
      for (const otherMed of medications) {
        if (otherMed.name === medName) continue
        const otherMedName = (otherMed.name || "").trim().toLowerCase()
        if (!otherMedName) continue

        const { rows: interactionRows } = await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `SELECT interaction_type, severity, description, clinical_significance, management_advice
           FROM drug_interactions
           WHERE (LOWER(medication1) = $1 AND LOWER(medication2) = $2)
              OR (LOWER(medication1) = $2 AND LOWER(medication2) = $1)`,
          [medNameLower, otherMedName],
        )

        for (const interaction of interactionRows) {
          const severity = interaction.severity === "Critical" ? "Critical" : interaction.severity === "Warning" ? "Warning" : "Info"
          validations.push({
            type: "DrugInteraction",
            severity,
            message: `${interaction.description || `Potential ${interaction.interaction_type} interaction between ${medName} and ${otherMed.name}`}. ${interaction.clinical_significance || ""} ${interaction.management_advice || ""}`,
            medicationName: medName,
            relatedMedication: otherMed.name,
          })
        }
      }

      // Check for contraindications
      const { rows: contraindicationRows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT contraindication_type, severity, condition_name, description
         FROM medication_contraindications
         WHERE LOWER(medication_name) = $1`,
        [medNameLower],
      )

      for (const contra of contraindicationRows) {
        const severity = contra.severity === "Absolute" ? "Critical" : contra.severity === "Relative" ? "Warning" : "Info"
        validations.push({
          type: "Contraindication",
          severity,
          message: `${medName} may be contraindicated for patients with ${contra.condition_name}. ${contra.description || ""}`,
          medicationName: medName,
        })
      }

      // Age-based validation
      if (patientAge !== null) {
        if (patientAge < 18 && medNameLower.includes("aspirin")) {
          validations.push({
            type: "Age",
            severity: "Warning",
            message: `Aspirin is generally not recommended for patients under 18 years due to risk of Reye's syndrome. Patient is ${patientAge} years old.`,
            medicationName: medName,
          })
        }
        if (patientAge > 65 && medNameLower.includes("warfarin")) {
          validations.push({
            type: "Dosage",
            severity: "Info",
            message: `Patient is ${patientAge} years old. Consider lower initial dose for warfarin in elderly patients.`,
            medicationName: medName,
          })
        }
      }
    }

    // Sort by severity
    validations.sort((a, b) => {
      const severityOrder = { Critical: 0, Warning: 1, Info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  } catch (err) {
    console.error("Error in validation:", err)
  }

  return validations
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      medications?: {
        name?: string
        dosage?: string
        frequency?: string
        duration?: string
        instructions?: string
        quantity?: number
      }[]
      priority?: string
      expiryDate?: string
      clinicalNotes?: string
      isControlledSubstance?: boolean
      refillsAuthorized?: number
      originalPrescriptionId?: string
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    const meds = Array.isArray(body.medications) ? body.medications : []
    const cleaned = meds
      .map((m) => ({
        name: (m.name || "").trim(),
        dosage: (m.dosage || "").trim(),
        frequency: (m.frequency || "").trim(),
        duration: (m.duration || "").trim(),
        instructions: (m.instructions || "").trim() || null,
        quantity: Number(m.quantity) || 1,
      }))
      .filter((m) => m.name && m.dosage && m.frequency && m.duration)

    if (!cleaned.length) {
      return NextResponse.json({ error: "At least one medication is required" }, { status: 400 })
    }

    // Perform prescription validation
    const validationWarnings = await validatePrescription(patientId, cleaned, auth)

    const priority = body.priority && ["Stat", "Urgent", "Routine", "Scheduled"].includes(body.priority) ? body.priority : "Routine"
    const expiryDate = body.expiryDate || null
    const clinicalNotes = body.clinicalNotes ? String(body.clinicalNotes).trim() || null : null
    const isControlledSubstance = body.isControlledSubstance === true
    const refillsAuthorized = Number.isFinite(body.refillsAuthorized) ? Math.max(0, Math.trunc(body.refillsAuthorized as number)) : 0
    const originalPrescriptionId = body.originalPrescriptionId ? String(body.originalPrescriptionId).trim() || null : null

    const created: any[] = []

    for (const med of cleaned) {
      const { rows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `INSERT INTO prescriptions (
           patient_id, doctor_id, medication_name, dosage, frequency, duration,
           instructions, quantity, status, priority, expiry_date, clinical_notes,
           is_controlled_substance, refills_authorized, refills_remaining, original_prescription_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending',$9,$10,$11,$12,$13,$13,$14)
         RETURNING id, patient_id, doctor_id, medication_name, dosage, frequency, duration,
                   instructions, quantity, status, priority, expiry_date, clinical_notes,
                   is_controlled_substance, refills_authorized, refills_remaining, original_prescription_id, created_at`,
        [
          patientId,
          auth.userId,
          med.name,
          med.dosage,
          med.frequency,
          med.duration,
          med.instructions,
          med.quantity,
          priority,
          expiryDate,
          clinicalNotes,
          isControlledSubstance,
          refillsAuthorized,
          originalPrescriptionId,
        ],
      )
      const prescriptionId = rows[0].id

      // Record validation warnings for this prescription
      if (validationWarnings.length > 0) {
        for (const validation of validationWarnings) {
          try {
            await queryWithSession(
              { role: auth.role, userId: auth.userId },
              `INSERT INTO prescription_validations (
                 prescription_id, validation_type, severity, message, medication_name, related_medication, validated_by
               ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                prescriptionId,
                validation.type,
                validation.severity,
                validation.message,
                validation.medicationName || null,
                validation.relatedMedication || null,
                auth.userId,
              ],
            )
          } catch (err) {
            // Non-fatal - continue
            console.error("Failed to record validation:", err)
          }
        }
      }

      created.push(rows[0])
    }

    // Notify all pharmacists of the new prescription(s)
    try {
      const ptRow = await query(`SELECT first_name, last_name FROM patients WHERE id = $1`, [patientId])
      const patientName = ptRow.rows[0]
        ? `${ptRow.rows[0].first_name || ""} ${ptRow.rows[0].last_name || ""}`.trim()
        : "a patient"
      const isStat = priority === "Stat"
      const medList = cleaned.map((m) => m.name).join(", ")
      await query(
        `INSERT INTO notifications (role, title, message, type, priority, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          "Pharmacist",
          isStat ? "STAT Prescription" : "New Prescription",
          `${cleaned.length} medication${cleaned.length > 1 ? "s" : ""} for ${patientName}: ${medList}${isStat ? " — dispense immediately" : ""}`,
          "Prescription",
          isStat ? "High" : "Normal",
          JSON.stringify({ prescriptionId: created[0]?.id, patientId, medicationCount: cleaned.length }),
        ],
      )
    } catch {
      // Non-fatal — prescription already saved
    }

    return NextResponse.json({
      prescriptions: created,
      validations: validationWarnings,
      hasCritical: validationWarnings.some((v: any) => v.severity === "Critical"),
    })
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to create prescription" }, { status: 500 })
  }
}

