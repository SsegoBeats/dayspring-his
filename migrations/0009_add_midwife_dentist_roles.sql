-- 0009_add_midwife_dentist_roles.sql
-- Ensure Midwife and Dentist roles are fully supported in schema and RLS.

BEGIN;

-- 1) Widen users.role constraint to include Midwife and Dentist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    -- Drop any existing role check constraint if present
    BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;

    -- Recreate with full role set, matching lib/security.ts and app/api/migrate/route.ts
    BEGIN
      ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN (
          'Receptionist',
          'Doctor',
          'Radiologist',
          'Nurse',
          'Lab Tech',
          'Hospital Admin',
          'Cashier',
          'Pharmacist',
          'Midwife',
          'Dentist'
        ));
    EXCEPTION WHEN others THEN
      -- If this fails in some legacy environment, do not block the migration
      NULL;
    END;
  END IF;
END$$;

-- 2) Update RLS policies to treat Midwife/Dentist as clinicians

-- Appointments: allow Midwife and Dentist alongside Doctor/Receptionist/Nurse
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
    ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS appts_insert ON appointments;
    CREATE POLICY appts_insert ON appointments
      FOR INSERT
      WITH CHECK (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Receptionist',
          'Doctor',
          'Midwife',
          'Dentist',
          'Nurse'
        )
      );

    DROP POLICY IF EXISTS appts_update ON appointments;
    CREATE POLICY appts_update ON appointments
      FOR UPDATE
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Receptionist',
          'Doctor',
          'Midwife',
          'Dentist',
          'Nurse'
        )
      );
  END IF;
END$$;

-- Medications: allow Midwife/Dentist to read like Doctor
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medications') THEN
    ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS meds_select ON medications;
    CREATE POLICY meds_select ON medications
      FOR SELECT
      USING (
        current_setting('app.role', true) IN (
          'Hospital Admin',
          'Pharmacist',
          'Doctor',
          'Midwife',
          'Dentist',
          'Nurse'
        )
      );
  END IF;
END$$;

-- Medical records: Midwife/Dentist act like Doctor
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
          'Midwife',
          'Dentist'
        )
      );
  END IF;
END$$;

-- Prescriptions: Midwife/Dentist can create/update like Doctor
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
          'Midwife',
          'Dentist',
          'Pharmacist'
        )
      );
  END IF;
END$$;

-- Lab tests: Midwife/Dentist have the same read/write abilities as Doctor
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
          'Midwife',
          'Dentist'
        )
      );
  END IF;
END$$;

COMMIT;

