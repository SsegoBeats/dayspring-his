import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create") && !can(auth.role, "pharmacy", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      medications?: Array<{
        name?: string
        dosage?: string
        frequency?: string
        duration?: string
      }>
    }

    const patientId = (body.patientId || "").trim()
    const medications = Array.isArray(body.medications) ? body.medications : []

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }

    if (medications.length === 0) {
      return NextResponse.json({ error: "At least one medication is required" }, { status: 400 })
    }

    const validations: Array<{
      type: string
      severity: "Critical" | "Warning" | "Info"
      message: string
      medicationName?: string
      relatedMedication?: string
    }> = []

    // Get patient information
    const { rows: patientRows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, first_name, last_name, date_of_birth, gender, allergies, blood_group 
       FROM patients WHERE id = $1`,
      [patientId],
    )

    if (patientRows.length === 0) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

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

      // 1. Check for allergies
      if (allergies && allergies.includes(medNameLower)) {
        validations.push({
          type: "Allergy",
          severity: "Critical",
          message: `Patient has known allergy to ${medName}. Prescription should not be dispensed.`,
          medicationName: medName,
        })
      }

      // 2. Check for duplicate active prescriptions
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

      // 3. Check for drug interactions with active medications
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

      // 4. Check for drug interactions within the new prescription
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

      // 5. Check for contraindications
      const { rows: contraindicationRows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `SELECT contraindication_type, severity, condition_name, description
         FROM medication_contraindications
         WHERE LOWER(medication_name) = $1`,
        [medNameLower],
      )

      for (const contra of contraindicationRows) {
        // Check if patient has the condition (basic check - can be enhanced with patient conditions table)
        const severity = contra.severity === "Absolute" ? "Critical" : contra.severity === "Relative" ? "Warning" : "Info"
        validations.push({
          type: "Contraindication",
          severity,
          message: `${medName} may be contraindicated for patients with ${contra.condition_name}. ${contra.description || ""}`,
          medicationName: medName,
        })
      }

      // 6. Age-based dosage validation (basic check)
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

    // Sort validations by severity (Critical first)
    validations.sort((a, b) => {
      const severityOrder = { Critical: 0, Warning: 1, Info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })

    return NextResponse.json({
      validations,
      hasCritical: validations.some((v) => v.severity === "Critical"),
      hasWarnings: validations.some((v) => v.severity === "Warning"),
    })
  } catch (err: any) {
    console.error("Error validating prescription:", err)
    return NextResponse.json({ error: "Failed to validate prescription" }, { status: 500 })
  }
}

