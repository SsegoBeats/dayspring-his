-- Add Radiologist to lab_tests RLS so the Radiologist Portal can load worklist, assign cases, submit reports, and add scans.
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
          'Nurse',
          'Radiologist'
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
          'Dentist',
          'Radiologist'
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
          'Dentist',
          'Radiologist'
        )
      );
  END IF;
END$$;
