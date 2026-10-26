BEGIN;

ALTER TABLE postnatal_visits
  ADD COLUMN IF NOT EXISTS general_assessment TEXT,
  ADD COLUMN IF NOT EXISTS pulse_rate INTEGER,
  ADD COLUMN IF NOT EXISTS respiratory_rate INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS other_observations TEXT,
  ADD COLUMN IF NOT EXISTS nutrition_intake TEXT,
  ADD COLUMN IF NOT EXISTS nutrition_food_access TEXT,
  ADD COLUMN IF NOT EXISTS nutrition_supplements TEXT,
  ADD COLUMN IF NOT EXISTS nutrition_counselling TEXT,
  ADD COLUMN IF NOT EXISTS cord_assessment TEXT,
  ADD COLUMN IF NOT EXISTS cord_care_provided TEXT,
  ADD COLUMN IF NOT EXISTS cord_advice TEXT,
  ADD COLUMN IF NOT EXISTS cord_concerns TEXT,
  ADD COLUMN IF NOT EXISTS cord_follow_up TEXT;

ALTER TABLE lab_tests
  ADD COLUMN IF NOT EXISTS postnatal_visit_id UUID
    REFERENCES postnatal_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_tests_postnatal_visit
  ON lab_tests(postnatal_visit_id)
  WHERE postnatal_visit_id IS NOT NULL;

COMMIT;
