-- Add barcode column to medications (if missing) and supporting index
ALTER TABLE medications ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_medications_barcode ON medications(barcode);

-- Create medication_stock_movements table to track inventory movements
CREATE TABLE IF NOT EXISTS medication_stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('Receive','Adjust','Dispense','Return')),
    quantity INTEGER NOT NULL,
    reference TEXT,
    batch_number VARCHAR(50),
    expiry_date DATE,
    barcode_snapshot VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS and policies for stock movements
ALTER TABLE medication_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medstock_select ON medication_stock_movements;
CREATE POLICY medstock_select ON medication_stock_movements
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS medstock_insert ON medication_stock_movements;
CREATE POLICY medstock_insert ON medication_stock_movements
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

