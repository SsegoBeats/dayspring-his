-- migrations/0031_labor_delivery_postnatal.sql
-- Add labor_delivery_records and postnatal_visits tables for the Midwife Portal.

BEGIN;

-- ── Labor & Delivery ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labor_delivery_records (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id               UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  midwife_id               UUID NOT NULL REFERENCES users(id),
  admission_date           TIMESTAMP NOT NULL,
  onset_of_labor           VARCHAR(20) CHECK (onset_of_labor IN ('spontaneous','induced','augmented')),
  delivery_date            TIMESTAMP,
  delivery_type            VARCHAR(20) CHECK (delivery_type IN ('SVD','C-Section','Forceps','Vacuum','Other')),
  duration_of_labor_hours  NUMERIC(5,2),
  presentation             VARCHAR(30),
  rupture_of_membranes     TIMESTAMP,
  placenta_delivery        TIMESTAMP,
  blood_loss_ml            INTEGER,
  complications            TEXT,
  notes                    TEXT,
  -- Baby sub-record
  baby_sex                 VARCHAR(15) CHECK (baby_sex IN ('Male','Female','Indeterminate')),
  baby_birth_weight_g      INTEGER,
  baby_apgar_1min          SMALLINT CHECK (baby_apgar_1min BETWEEN 0 AND 10),
  baby_apgar_5min          SMALLINT CHECK (baby_apgar_5min BETWEEN 0 AND 10),
  baby_condition           VARCHAR(20) CHECK (baby_condition IN ('Alive','Stillbirth','Neonatal Death')),
  baby_notes               TEXT,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labor_delivery_patient
  ON labor_delivery_records(patient_id, admission_date DESC);

CREATE INDEX IF NOT EXISTS idx_labor_delivery_midwife
  ON labor_delivery_records(midwife_id);

-- ── Postnatal Visits ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postnatal_visits (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  labor_delivery_id    UUID REFERENCES labor_delivery_records(id) ON DELETE SET NULL,
  midwife_id           UUID NOT NULL REFERENCES users(id),
  visit_date           TIMESTAMP NOT NULL,
  days_postpartum      INTEGER,
  bp_systolic          INTEGER,
  bp_diastolic         INTEGER,
  temperature_c        NUMERIC(4,1),
  lochia               VARCHAR(10) CHECK (lochia IN ('rubra','serosa','alba','abnormal')),
  wound_healing        TEXT,
  breastfeeding_status VARCHAR(30),
  baby_weight_g        INTEGER,
  baby_condition       TEXT,
  notes                TEXT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_postnatal_patient
  ON postnatal_visits(patient_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_postnatal_labor
  ON postnatal_visits(labor_delivery_id);

CREATE INDEX IF NOT EXISTS idx_postnatal_midwife
  ON postnatal_visits(midwife_id);

-- ── RLS: labor_delivery_records ─────────────────────────────────────────────
ALTER TABLE labor_delivery_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labor_select ON labor_delivery_records;
CREATE POLICY labor_select ON labor_delivery_records FOR SELECT
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife','Nurse'
  ));

DROP POLICY IF EXISTS labor_insert ON labor_delivery_records;
CREATE POLICY labor_insert ON labor_delivery_records FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS labor_update ON labor_delivery_records;
CREATE POLICY labor_update ON labor_delivery_records FOR UPDATE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ))
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS labor_delete ON labor_delivery_records;
CREATE POLICY labor_delete ON labor_delivery_records FOR DELETE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Midwife'
  ));

-- ── RLS: postnatal_visits ───────────────────────────────────────────────────
ALTER TABLE postnatal_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS postnatal_select ON postnatal_visits;
CREATE POLICY postnatal_select ON postnatal_visits FOR SELECT
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife','Nurse'
  ));

DROP POLICY IF EXISTS postnatal_insert ON postnatal_visits;
CREATE POLICY postnatal_insert ON postnatal_visits FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS postnatal_update ON postnatal_visits;
CREATE POLICY postnatal_update ON postnatal_visits FOR UPDATE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ))
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS postnatal_delete ON postnatal_visits;
CREATE POLICY postnatal_delete ON postnatal_visits FOR DELETE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Midwife'
  ));

COMMIT;
