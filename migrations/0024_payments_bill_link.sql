ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_bill_created
  ON payments(bill_id, created_at DESC);
