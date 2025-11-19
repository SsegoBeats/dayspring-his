-- 0010_obstetric_dental_enhancements.sql
-- Add obstetric and dental clinical tables and RLS, so Midwife and Dentist roles
-- have first-class, persisted workflows.

BEGIN;

-- Obstetric assessments (midwifery)
CREATE TABLE IF NOT EXISTS obstetric_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES users(id),
  visit_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  gravida INTEGER,
  parity INTEGER,
  gestational_age_weeks INTEGER,
  edd DATE,
  fundal_height_cm NUMERIC(4,1),
  fetal_heart_rate INTEGER,
  presentation VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obstetric_assessments_patient_date
  ON obstetric_assessments(patient_id, visit_date DESC);

-- Dental records
CREATE TABLE IF NOT EXISTS dental_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dentist_id UUID NOT NULL REFERENCES users(id),
  visit_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diagnosis TEXT,
  procedure_performed TEXT,
  tooth_chart JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dental_records_patient_date
  ON dental_records(patient_id, visit_date DESC);

-- RLS for obstetric assessments
ALTER TABLE obstetric_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obs_select ON obstetric_assessments;
CREATE POLICY obs_select ON obstetric_assessments
  FOR SELECT
  USING (
    current_setting('app.role', true) IN (
      'Hospital Admin',
      'Doctor',
      'Midwife',
      'Nurse'
    )
  );

DROP POLICY IF EXISTS obs_insert ON obstetric_assessments;
CREATE POLICY obs_insert ON obstetric_assessments
  FOR INSERT
  WITH CHECK (
    current_setting('app.role', true) IN (
      'Hospital Admin',
      'Doctor',
      'Midwife'
    )
  );

-- RLS for dental records
ALTER TABLE dental_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dental_select ON dental_records;
CREATE POLICY dental_select ON dental_records
  FOR SELECT
  USING (
    current_setting('app.role', true) IN (
      'Hospital Admin',
      'Doctor',
      'Dentist'
    )
  );

DROP POLICY IF EXISTS dental_insert ON dental_records;
CREATE POLICY dental_insert ON dental_records
  FOR INSERT
  WITH CHECK (
    current_setting('app.role', true) IN (
      'Hospital Admin',
      'Doctor',
      'Dentist'
    )
  );

COMMIT;

