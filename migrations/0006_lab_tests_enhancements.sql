-- Lab tests enhancements for Lab Tech portal
-- Adds columns used by ordering, specimen workflow, review, and exports

ALTER TABLE IF EXISTS lab_tests
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Routine',
  ADD COLUMN IF NOT EXISTS specimen_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS accession_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Helpful indexes for dashboards and exports
CREATE INDEX IF NOT EXISTS idx_lab_tests_ordered ON lab_tests(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_tests_accession ON lab_tests(accession_number);

