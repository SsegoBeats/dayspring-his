-- Prescription Management Enhancements
-- This migration adds safety checks, validation, and enhanced prescription tracking

-- Add prescription priority and expiry tracking
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Routine' CHECK (priority IN ('Stat', 'Urgent', 'Routine', 'Scheduled'));
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS clinical_notes TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_controlled_substance BOOLEAN DEFAULT FALSE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills_remaining INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refills_authorized INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS original_prescription_id UUID REFERENCES prescriptions(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- Create prescription validation log for safety checks
CREATE TABLE IF NOT EXISTS prescription_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    validation_type VARCHAR(50) NOT NULL CHECK (validation_type IN ('Allergy', 'DrugInteraction', 'Dosage', 'Duplicate', 'Contraindication', 'Age', 'Pregnancy', 'Renal', 'Hepatic')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
    message TEXT NOT NULL,
    medication_name VARCHAR(255),
    related_medication VARCHAR(255),
    validated_by UUID REFERENCES users(id),
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    override_reason TEXT,
    overridden_by UUID REFERENCES users(id),
    overridden_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescription_validations_prescription_id ON prescription_validations(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_validations_type ON prescription_validations(validation_type);
CREATE INDEX IF NOT EXISTS idx_prescription_validations_severity ON prescription_validations(severity);

-- Enable RLS for prescription_validations
ALTER TABLE prescription_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescval_select ON prescription_validations;
CREATE POLICY prescval_select ON prescription_validations
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist','Nurse'));

DROP POLICY IF EXISTS prescval_insert ON prescription_validations;
CREATE POLICY prescval_insert ON prescription_validations
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist'));

DROP POLICY IF EXISTS prescval_update ON prescription_validations;
CREATE POLICY prescval_update ON prescription_validations
  FOR UPDATE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist'));

-- Create drug interaction reference table
CREATE TABLE IF NOT EXISTS drug_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication1 VARCHAR(255) NOT NULL,
    medication2 VARCHAR(255) NOT NULL,
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('Major', 'Moderate', 'Minor', 'Unknown')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
    description TEXT NOT NULL,
    clinical_significance TEXT,
    management_advice TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medication1, medication2)
);

CREATE INDEX IF NOT EXISTS idx_drug_interactions_med1 ON drug_interactions(medication1);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_med2 ON drug_interactions(medication2);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_type ON drug_interactions(interaction_type);

-- Create medication contraindications table
CREATE TABLE IF NOT EXISTS medication_contraindications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_name VARCHAR(255) NOT NULL,
    contraindication_type VARCHAR(50) NOT NULL CHECK (contraindication_type IN ('Condition', 'Age', 'Pregnancy', 'Renal', 'Hepatic', 'Allergy', 'Other')),
    condition_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Absolute', 'Relative', 'Warning')),
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_med_contraindications_medication ON medication_contraindications(medication_name);
CREATE INDEX IF NOT EXISTS idx_med_contraindications_type ON medication_contraindications(contraindication_type);

-- Create prescription templates for common medications
CREATE TABLE IF NOT EXISTS prescription_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    instructions TEXT,
    conditions TEXT[], -- Array of conditions this template is for
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_prescription_templates_category ON prescription_templates(category);
CREATE INDEX IF NOT EXISTS idx_prescription_templates_active ON prescription_templates(is_active);

-- Enable RLS for prescription_templates
ALTER TABLE prescription_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prestemp_select ON prescription_templates;
CREATE POLICY prestemp_select ON prescription_templates
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist','Nurse'));

DROP POLICY IF EXISTS prestemp_insert ON prescription_templates;
CREATE POLICY prestemp_insert ON prescription_templates
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist'));

DROP POLICY IF EXISTS prestemp_update ON prescription_templates;
CREATE POLICY prestemp_update ON prescription_templates
  FOR UPDATE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Midwife','Dentist'));

-- Create prescription refill tracking
CREATE TABLE IF NOT EXISTS prescription_refills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    refill_number INTEGER NOT NULL,
    dispensed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dispensed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescription_refills_prescription_id ON prescription_refills(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_refills_dispensed_at ON prescription_refills(dispensed_at);

-- Enable RLS for prescription_refills
ALTER TABLE prescription_refills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presrefill_select ON prescription_refills;
CREATE POLICY presrefill_select ON prescription_refills
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist','Nurse'));

DROP POLICY IF EXISTS presrefill_insert ON prescription_refills;
CREATE POLICY presrefill_insert ON prescription_refills
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Add function to check for duplicate active prescriptions
CREATE OR REPLACE FUNCTION check_duplicate_prescription(
    p_patient_id UUID,
    p_medication_name VARCHAR,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    prescription_id UUID,
    medication_name VARCHAR,
    created_at TIMESTAMP,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.id,
        pr.medication_name,
        pr.created_at,
        pr.status
    FROM prescriptions pr
    WHERE pr.patient_id = p_patient_id
      AND LOWER(pr.medication_name) = LOWER(p_medication_name)
      AND pr.status IN ('Pending', 'Dispensed')
      AND pr.created_at >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL
    ORDER BY pr.created_at DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get patient active medications
CREATE OR REPLACE FUNCTION get_patient_active_medications(
    p_patient_id UUID
)
RETURNS TABLE (
    medication_name VARCHAR,
    dosage VARCHAR,
    frequency VARCHAR,
    start_date TIMESTAMP,
    prescription_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.medication_name,
        pr.dosage,
        pr.frequency,
        pr.created_at,
        pr.id
    FROM prescriptions pr
    WHERE pr.patient_id = p_patient_id
      AND pr.status = 'Dispensed'
      AND (pr.expiry_date IS NULL OR pr.expiry_date >= CURRENT_DATE)
    ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

