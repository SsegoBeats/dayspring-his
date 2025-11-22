-- LOINC catalog and structured lab enhancements
CREATE TABLE IF NOT EXISTS loinc_tests (
    loinc_code VARCHAR(20) PRIMARY KEY,
    component TEXT,
    property TEXT,
    time_aspct TEXT,
    system TEXT,
    scale_typ TEXT,
    method_typ TEXT,
    class TEXT,
    classtype INTEGER,
    long_common_name TEXT,
    shortname TEXT,
    units TEXT,
    example_units TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loinc_text_search ON loinc_tests USING gin (to_tsvector('simple', coalesce(loinc_code,'') || ' ' || coalesce(long_common_name,'') || ' ' || coalesce(shortname,'')));

-- Extend lab_tests with LOINC metadata and structured results
ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20) REFERENCES loinc_tests(loinc_code),
  ADD COLUMN IF NOT EXISTS loinc_long_name TEXT,
  ADD COLUMN IF NOT EXISTS loinc_property TEXT,
  ADD COLUMN IF NOT EXISTS loinc_scale TEXT,
  ADD COLUMN IF NOT EXISTS loinc_system TEXT,
  ADD COLUMN IF NOT EXISTS loinc_time_aspct TEXT,
  ADD COLUMN IF NOT EXISTS loinc_class TEXT,
  ADD COLUMN IF NOT EXISTS loinc_units TEXT,
  ADD COLUMN IF NOT EXISTS result_json JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc ON lab_tests(loinc_code);
