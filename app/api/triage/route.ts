import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

const TriageSchema = z.object({
  patientId: z.string().uuid(),
  mode: z.enum(["Adult", "Child"]).default("Adult"),
  systolic: z.number().int().min(50).max(260).optional().nullable(),
  diastolic: z.number().int().min(30).max(160).optional().nullable(),
  heartRate: z.number().int().min(20).max(220).optional().nullable(),
  respiratoryRate: z.number().int().min(5).max(60).optional().nullable(),
  temperature: z.number().min(30).max(43).optional().nullable(),
  spo2: z.number().int().min(50).max(100).optional().nullable(),
  avpu: z.enum(["A", "V", "P", "U"]).optional().nullable(),
  mobility: z.string().optional().nullable(),
  chiefComplaint: z.string().min(3).max(500),
  // New fields for Ugandan standards
  painLevel: z.number().int().min(0).max(10).default(0),
  isPregnant: z.boolean().default(false),
  pregnancyWeeks: z.number().int().min(1).max(42).optional().nullable(),
  isPostpartum: z.boolean().default(false),
  postpartumDays: z.number().int().min(0).max(42).optional().nullable(),
  hasTrauma: z.boolean().default(false),
  traumaType: z.enum(["blunt", "penetrating", "burns", "fall", "rta", "other"]).optional().nullable(),
  traumaMechanism: z.string().max(200).optional().nullable(),
  burnsPercentage: z.number().min(0).max(100).optional().nullable(),
  weight: z.number().min(1).max(200).optional().nullable(),
  hasRespiratoryDistress: z.boolean().default(false),
  hasChestPain: z.boolean().default(false),
  hasSevereBleeding: z.boolean().default(false),
  discriminators: z.array(z.string()).default([]),
  // Additional receptionist-capable measurements (optional)
  heightCm: z.number().min(30).max(230).optional().nullable(),
  bloodGlucose: z.number().min(1).max(40).optional().nullable(), // mmol/L (RBS)
  capillaryRefill: z.number().min(0).max(10).optional().nullable(), // seconds
  muacCm: z.number().min(5).max(30).optional().nullable(), // pediatric MUAC
  notes: z.string().max(1000).optional().nullable(),
})

/**
 * Enhanced Ugandan-standard triage category calculation
 * Based on WHO guidelines adapted for Uganda healthcare context
 */
function computeCategory(input: z.infer<typeof TriageSchema>): "Emergency" | "Very Urgent" | "Urgent" | "Routine" {
  // Emergency criteria - immediate life-threatening
  if (input.avpu === "U") return "Emergency"
  if (input.spo2 && input.spo2 < 90) return "Emergency"
  if (input.hasSevereBleeding) return "Emergency"
  if (input.burnsPercentage && input.burnsPercentage > 20) return "Emergency"
  
  // Very Urgent criteria - potentially life-threatening within minutes
  if (input.temperature && input.temperature >= 40) return "Very Urgent"
  if (input.temperature && input.temperature < 35) return "Very Urgent"
  
  // Heart rate abnormalities
  if (input.mode === "Adult") {
    if (input.heartRate && (input.heartRate > 130 || input.heartRate < 40)) return "Very Urgent"
  } else {
    // Pediatric ranges
    if (input.heartRate && (input.heartRate > 160 || input.heartRate < 60)) return "Very Urgent"
  }
  
  // Blood pressure
  if (input.systolic && input.systolic < 90) return "Very Urgent"
  if (input.systolic && input.systolic > 180) return "Very Urgent"
  
  // Respiratory issues
  if (input.hasRespiratoryDistress) return "Very Urgent"
  if (input.respiratoryRate) {
    if (input.mode === "Adult") {
      if (input.respiratoryRate > 30 || input.respiratoryRate < 10) return "Very Urgent"
    } else {
      if (input.respiratoryRate > 40 || input.respiratoryRate < 15) return "Very Urgent"
    }
  }
  
  // Obstetric emergencies
  if (input.isPregnant && input.hasChestPain) return "Very Urgent"
  if (input.isPregnant && input.hasRespiratoryDistress) return "Very Urgent"
  if (input.isPostpartum && input.postpartumDays && input.postpartumDays <= 7 && input.hasChestPain) return "Very Urgent"
  
  // Trauma
  if (input.hasTrauma && input.traumaType === "penetrating") return "Very Urgent"
  if (input.hasTrauma && input.traumaType === "rta") return "Very Urgent"
  
  // Urgent criteria - requires prompt attention within 1-2 hours
  if (input.painLevel >= 7) return "Urgent"
  if (input.hasChestPain) return "Urgent"
  if (input.hasTrauma && input.traumaType === "burns" && input.burnsPercentage && input.burnsPercentage > 10) return "Urgent"
  if (input.temperature && input.temperature >= 38.5) return "Urgent"
  if (input.heartRate && input.heartRate > 100) return "Urgent"
  
  // Routine - non-urgent cases
  return "Routine"
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(can(auth.role, "medical", "create") || can(auth.role, "patients", "update"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    
    const body = await req.json()
    const t = TriageSchema.parse(body)

    // Ensure schema exists (idempotent)
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS triage_assessments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          recorded_by UUID REFERENCES users(id),
          mode VARCHAR(20) DEFAULT 'Adult' CHECK (mode IN ('Adult','Child')),
          blood_pressure_systolic INTEGER,
          blood_pressure_diastolic INTEGER,
          heart_rate INTEGER,
          respiratory_rate INTEGER,
          temperature DECIMAL(4,1),
          oxygen_saturation INTEGER,
          avpu VARCHAR(10) CHECK (avpu IN ('A','V','P','U')),
          mobility VARCHAR(30),
          chief_complaint TEXT,
          discriminators JSONB,
          category VARCHAR(20) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
      // Ensure patients.triage_category accepts 'Routine'
      await query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='triage_category'
          ) THEN
            BEGIN
              ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_triage_category_check;
            EXCEPTION WHEN others THEN NULL; END;
            BEGIN
              ALTER TABLE patients ADD CONSTRAINT patients_triage_category_check
                CHECK (triage_category IS NULL OR triage_category IN ('Emergency','Very Urgent','Urgent','Routine','Standard','Non-urgent'));
            EXCEPTION WHEN others THEN NULL; END;
          END IF;
        END $$;
      `)
    } catch {}
    const category = computeCategory(t)

    // Enhanced triage data with all new fields
    const triageData = {
      patient_id: t.patientId,
      recorded_by: auth.userId || null,
      mode: t.mode,
      blood_pressure_systolic: t.systolic || null,
      blood_pressure_diastolic: t.diastolic || null,
      heart_rate: t.heartRate || null,
      respiratory_rate: t.respiratoryRate || null,
      temperature: t.temperature || null,
      oxygen_saturation: t.spo2 || null,
      avpu: t.avpu || null,
      mobility: t.mobility || null,
      chief_complaint: t.chiefComplaint,
      discriminators: JSON.stringify(t.discriminators || []),
      category: category,
      // New fields stored in JSONB metadata
      metadata: JSON.stringify({
        painLevel: t.painLevel,
        isPregnant: t.isPregnant,
        pregnancyWeeks: t.pregnancyWeeks,
        isPostpartum: t.isPostpartum,
        postpartumDays: t.postpartumDays,
        hasTrauma: t.hasTrauma,
        traumaType: t.traumaType,
        traumaMechanism: t.traumaMechanism,
        burnsPercentage: t.burnsPercentage,
        weight: t.weight,
        hasRespiratoryDistress: t.hasRespiratoryDistress,
        hasChestPain: t.hasChestPain,
        hasSevereBleeding: t.hasSevereBleeding,
        heightCm: t.heightCm,
        bloodGlucose: t.bloodGlucose,
        capillaryRefill: t.capillaryRefill,
        muacCm: t.muacCm,
        notes: t.notes,
      }),
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO triage_assessments (
        patient_id, recorded_by, mode, blood_pressure_systolic, blood_pressure_diastolic,
        heart_rate, respiratory_rate, temperature, oxygen_saturation, avpu, mobility,
        chief_complaint, discriminators, category, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15::jsonb)
      RETURNING id`,
      [
        triageData.patient_id,
        triageData.recorded_by,
        triageData.mode,
        triageData.blood_pressure_systolic,
        triageData.blood_pressure_diastolic,
        triageData.heart_rate,
        triageData.respiratory_rate,
        triageData.temperature,
        triageData.oxygen_saturation,
        triageData.avpu,
        triageData.mobility,
        triageData.chief_complaint,
        triageData.discriminators,
        triageData.category,
        triageData.metadata,
      ],
    )

    // Update patient's current triage category
    await query(
      `UPDATE patients 
       SET triage_category = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [category, t.patientId]
    )

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auth.userId,
        "TRIAGE_CREATED",
        "TriageAssessment",
        rows[0].id,
        JSON.stringify({ category, mode: t.mode, chiefComplaint: t.chiefComplaint })
      ]
    )

    return NextResponse.json({ id: rows[0].id, category })
  } catch (error: any) {
    console.error("Error creating triage assessment:", error)
    return NextResponse.json(
      { error: "Failed to create triage assessment", details: error.message },
      { status: 500 }
    )
  }
}
