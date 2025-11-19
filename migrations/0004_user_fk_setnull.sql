-- Normalize foreign keys to allow hard-deleting users while preserving records
-- Strategy: columns that point to the responsible user become nullable and
-- set to NULL on user deletion. Schedules and tokens continue to cascade.

-- 1) Make strict columns nullable where appropriate
ALTER TABLE IF EXISTS medical_records ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE IF EXISTS vital_signs ALTER COLUMN nurse_id DROP NOT NULL;
ALTER TABLE IF EXISTS nursing_notes ALTER COLUMN nurse_id DROP NOT NULL;
ALTER TABLE IF EXISTS prescriptions ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE IF EXISTS lab_tests ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE IF EXISTS radiology_tests ALTER COLUMN doctor_id DROP NOT NULL;
ALTER TABLE IF EXISTS patient_routing ALTER COLUMN routed_by DROP NOT NULL;
ALTER TABLE IF EXISTS bed_assignments ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE IF EXISTS checkins ALTER COLUMN receptionist_id DROP NOT NULL;

-- 2) Rebuild FKs to users(id) with ON DELETE SET NULL for operational records
DO $$
DECLARE
  rec RECORD;
  r RECORD;
  fk_name TEXT;
BEGIN
  -- List of (table, column) pairs to set ON DELETE SET NULL
  FOR rec IN SELECT * FROM (
    VALUES
      ('triage_assessments','recorded_by'),
      ('appointments','doctor_id'),
      ('appointments','created_by'),
      ('medical_records','doctor_id'),
      ('vital_signs','nurse_id'),
      ('nursing_notes','nurse_id'),
      ('prescriptions','doctor_id'),
      ('prescriptions','dispensed_by'),
      ('lab_tests','doctor_id'),
      ('lab_tests','lab_tech_id'),
      ('radiology_tests','doctor_id'),
      ('radiology_tests','radiologist_id'),
      ('bills','cashier_id'),
      ('payments','cashier_id'),
      ('patient_routing','routed_by'),
      ('bed_assignments','assigned_by'),
      ('checkins','receptionist_id'),
      ('documents','uploaded_by')
  ) AS t(tab, col) LOOP
    -- find existing fk name for this table/column referencing users
    PERFORM 1;
    FOR r IN 
      SELECT tc.constraint_name AS constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = rec.tab
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = rec.col
    LOOP
      fk_name := r.constraint_name;
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.tab, fk_name);
    END LOOP;
    -- recreate as ON DELETE SET NULL
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL', rec.tab, rec.tab||'_'||rec.col||'_fkey', rec.col);
  END LOOP;
END$$;
