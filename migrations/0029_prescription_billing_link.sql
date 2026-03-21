-- Migration 0029: Dual billing flow — visit_type on prescriptions, prescription_id on bills
-- OPD prescriptions auto-create a bill at prescription time (pay-before-dispense)
-- INPATIENT/EMERGENCY prescriptions auto-create a bill at dispense time (dispense-then-bill)

-- 1. Add visit_type to prescriptions
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS visit_type VARCHAR(20) NOT NULL DEFAULT 'OPD'
    CHECK (visit_type IN ('OPD', 'INPATIENT', 'EMERGENCY'));

-- 2. Link bills back to the originating prescription (nullable — not all bills come from prescriptions)
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_prescription_id ON bills(prescription_id);