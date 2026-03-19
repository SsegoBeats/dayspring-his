-- Patient allergies
CREATE TABLE IF NOT EXISTS patient_allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('mild','moderate','severe')),
    diagnosed_date DATE,
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient ON patient_allergies(patient_id);

-- Patient immunizations
CREATE TABLE IF NOT EXISTS patient_immunizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    vaccine_name TEXT NOT NULL,
    date_administered DATE NOT NULL,
    next_due_date DATE,
    administered_by TEXT,
    batch_number VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_patient_immunizations_patient ON patient_immunizations(patient_id);

-- Patient chronic conditions
CREATE TABLE IF NOT EXISTS patient_chronic_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition TEXT NOT NULL,
    diagnosed_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','managed','resolved')),
    medications TEXT[],
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_patient_chronic_conditions_patient ON patient_chronic_conditions(patient_id);

-- Add file_name and notes to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS notes TEXT;

-- RLS: patient_allergies
ALTER TABLE patient_allergies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allergy_select ON patient_allergies;
CREATE POLICY allergy_select ON patient_allergies FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS allergy_insert ON patient_allergies;
CREATE POLICY allergy_insert ON patient_allergies FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS allergy_update ON patient_allergies;
CREATE POLICY allergy_update ON patient_allergies FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist'));
DROP POLICY IF EXISTS allergy_delete ON patient_allergies;
CREATE POLICY allergy_delete ON patient_allergies FOR DELETE USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician'));

-- RLS: patient_immunizations
ALTER TABLE patient_immunizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS imm_select ON patient_immunizations;
CREATE POLICY imm_select ON patient_immunizations FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS imm_insert ON patient_immunizations;
CREATE POLICY imm_insert ON patient_immunizations FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS imm_update ON patient_immunizations;
CREATE POLICY imm_update ON patient_immunizations FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist'));

-- RLS: patient_chronic_conditions
ALTER TABLE patient_chronic_conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chronic_select ON patient_chronic_conditions;
CREATE POLICY chronic_select ON patient_chronic_conditions FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS chronic_insert ON patient_chronic_conditions;
CREATE POLICY chronic_insert ON patient_chronic_conditions FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse'));
DROP POLICY IF EXISTS chronic_update ON patient_chronic_conditions;
CREATE POLICY chronic_update ON patient_chronic_conditions FOR UPDATE USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist'));

-- RLS: documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS docs_select ON documents;
CREATE POLICY docs_select ON documents FOR SELECT USING (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse','Receptionist'));
DROP POLICY IF EXISTS docs_insert ON documents;
CREATE POLICY docs_insert ON documents FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Clinician','Midwife','Dentist','Nurse','Receptionist'));
DROP POLICY IF EXISTS docs_delete ON documents;
CREATE POLICY docs_delete ON documents FOR DELETE USING (current_setting('app.role', true) IN ('Hospital Admin'));
