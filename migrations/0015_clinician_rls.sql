-- 0015_clinician_rls.sql
-- Add Clinician role to users constraint and to RLS policies so Clinician
-- has the same data access as Doctor for medical records, prescriptions, and lab tests.

BEGIN;

-- 1) Add 'Clinician' to users.role constraint (match lib/security.ts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN (
        'Receptionist',
        'Doctor',
        'Clinician',
        'Radiologist',
        'Nurse',
        'Lab Tech',
        'Hospital Admin',
        'Cashier',
        'Pharmacist',
        'Midwife',
        'Dentist'
      ));
  END IF;
END$$;

-- 2) Medical records: add Clinician to SELECT, INSERT, UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medical_records') THEN
    ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS medrec_select ON medical_records;
    CREATE POLICY medrec_select ON medical_records
      FOR SELECT
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist',
          'Nurse'
        )
      );

    DROP POLICY IF EXISTS medrec_insert ON medical_records;
    CREATE POLICY medrec_insert ON medical_records
      FOR INSERT
      WITH CHECK (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist'
        )
      );

    DROP POLICY IF EXISTS medrec_update ON medical_records;
    CREATE POLICY medrec_update ON medical_records
      FOR UPDATE
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist'
        )
      );
  END IF;
END$$;

-- 3) Prescriptions: add Clinician to SELECT, INSERT, UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') THEN
    ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS rx_select ON prescriptions;
    CREATE POLICY rx_select ON prescriptions
      FOR SELECT
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist',
          'Pharmacist'
        )
      );

    DROP POLICY IF EXISTS rx_insert ON prescriptions;
    CREATE POLICY rx_insert ON prescriptions
      FOR INSERT
      WITH CHECK (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist'
        )
      );

    DROP POLICY IF EXISTS rx_update ON prescriptions;
    CREATE POLICY rx_update ON prescriptions
      FOR UPDATE
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist',
          'Pharmacist'
        )
      );
  END IF;
END$$;

-- 4) Lab tests: add Clinician to SELECT, INSERT, UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_tests') THEN
    ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS lab_select ON lab_tests;
    CREATE POLICY lab_select ON lab_tests
      FOR SELECT
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist',
          'Lab Tech',
          'Nurse'
        )
      );

    DROP POLICY IF EXISTS lab_insert ON lab_tests;
    CREATE POLICY lab_insert ON lab_tests
      FOR INSERT
      WITH CHECK (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist'
        )
      );

    DROP POLICY IF EXISTS lab_update ON lab_tests;
    CREATE POLICY lab_update ON lab_tests
      FOR UPDATE
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Lab Tech',
          'Doctor',
          'Clinician',
          'Midwife',
          'Dentist'
        )
      );
  END IF;
END$$;

-- 5) prescription_validations (from 0013): add Clinician
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescription_validations') THEN
    ALTER TABLE prescription_validations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS prescval_select ON prescription_validations;
    CREATE POLICY prescval_select ON prescription_validations
      FOR SELECT
      USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Clinician','Midwife','Dentist','Nurse'));

    DROP POLICY IF EXISTS prescval_insert ON prescription_validations;
    CREATE POLICY prescval_insert ON prescription_validations
      FOR INSERT
      WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Clinician','Midwife','Dentist'));

    DROP POLICY IF EXISTS prescval_update ON prescription_validations;
    CREATE POLICY prescval_update ON prescription_validations
      FOR UPDATE
      USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Clinician','Midwife','Dentist'));
  END IF;
END$$;

-- 6) prescription_templates: add Clinician
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescription_templates') THEN
    ALTER TABLE prescription_templates ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS prestemp_select ON prescription_templates;
    CREATE POLICY prestemp_select ON prescription_templates
      FOR SELECT
      USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Clinician','Midwife','Dentist','Nurse'));

    DROP POLICY IF EXISTS prestemp_insert ON prescription_templates;
    CREATE POLICY prestemp_insert ON prescription_templates
      FOR INSERT
      WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Clinician','Midwife','Dentist'));

    DROP POLICY IF EXISTS prestemp_update ON prescription_templates;
    CREATE POLICY prestemp_update ON prescription_templates
      FOR UPDATE
      USING (current_setting('app.role', true) IN ('Hospital Admin','Doctor','Clinician','Midwife','Dentist'));
  END IF;
END$$;

-- 7) prescription_refills: add Clinician to SELECT (insert remains Pharmacist-only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescription_refills') THEN
    ALTER TABLE prescription_refills ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS presrefill_select ON prescription_refills;
    CREATE POLICY presrefill_select ON prescription_refills
      FOR SELECT
      USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Clinician','Midwife','Dentist','Nurse'));
  END IF;
END$$;

COMMIT;
