-- Inventory Management Enhancements
-- This migration adds batch-level tracking, cost tracking, min/max levels, and audit functionality

-- Add cost_price column to medications (for profit analysis)
ALTER TABLE medications ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
CREATE INDEX IF NOT EXISTS idx_medications_cost_price ON medications(cost_price);

-- Add minimum and maximum stock levels
ALTER TABLE medications ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS max_stock_level INTEGER;

-- Add last_restocked_at for tracking restocking frequency
ALTER TABLE medications ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMP;

-- Create medication_batches table for batch-level tracking (FIFO/FEFO)
CREATE TABLE IF NOT EXISTS medication_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    expiry_date DATE,
    cost_price NUMERIC(10,2),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medication_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_medication_batches_medication_id ON medication_batches(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_batches_expiry ON medication_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_medication_batches_received_at ON medication_batches(received_at);

-- Enable RLS for medication_batches
ALTER TABLE medication_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medbatches_select ON medication_batches;
CREATE POLICY medbatches_select ON medication_batches
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Doctor','Midwife','Dentist','Nurse'));

DROP POLICY IF EXISTS medbatches_insert ON medication_batches;
CREATE POLICY medbatches_insert ON medication_batches
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS medbatches_update ON medication_batches;
CREATE POLICY medbatches_update ON medication_batches
  FOR UPDATE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Create stock_taking (physical inventory audit) table
CREATE TABLE IF NOT EXISTS stock_taking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    recorded_quantity INTEGER NOT NULL CHECK (recorded_quantity >= 0),
    system_quantity INTEGER NOT NULL CHECK (system_quantity >= 0),
    variance INTEGER NOT NULL,
    notes TEXT,
    taken_by UUID REFERENCES users(id),
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected'))
);

CREATE INDEX IF NOT EXISTS idx_stock_taking_medication_id ON stock_taking(medication_id);
CREATE INDEX IF NOT EXISTS idx_stock_taking_taken_at ON stock_taking(taken_at);
CREATE INDEX IF NOT EXISTS idx_stock_taking_status ON stock_taking(status);

-- Enable RLS for stock_taking
ALTER TABLE stock_taking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stocktaking_select ON stock_taking;
CREATE POLICY stocktaking_select ON stock_taking
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS stocktaking_insert ON stock_taking;
CREATE POLICY stocktaking_insert ON stock_taking
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS stocktaking_update ON stock_taking;
CREATE POLICY stocktaking_update ON stock_taking
  FOR UPDATE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Create medication_usage_analytics table for demand forecasting
CREATE TABLE IF NOT EXISTS medication_usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    quantity_dispensed INTEGER NOT NULL DEFAULT 0,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    average_daily_usage NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(medication_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_medication_usage_medication_id ON medication_usage_analytics(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_usage_period ON medication_usage_analytics(period_start, period_end);

-- Enable RLS for medication_usage_analytics
ALTER TABLE medication_usage_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medusage_select ON medication_usage_analytics;
CREATE POLICY medusage_select ON medication_usage_analytics
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS medusage_insert ON medication_usage_analytics;
CREATE POLICY medusage_insert ON medication_usage_analytics
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Update medication_stock_movements to reference batch_id
ALTER TABLE medication_stock_movements ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES medication_batches(id) ON DELETE SET NULL;

-- Add trigger to update medication_batches updated_at
CREATE OR REPLACE FUNCTION update_medication_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_medication_batches_updated_at ON medication_batches;
CREATE TRIGGER update_medication_batches_updated_at
    BEFORE UPDATE ON medication_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_medication_batches_updated_at();

-- Add function to calculate inventory valuation
CREATE OR REPLACE FUNCTION calculate_inventory_valuation()
RETURNS TABLE (
    total_cost_value NUMERIC,
    total_selling_value NUMERIC,
    total_profit_margin NUMERIC,
    medication_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(m.stock_quantity * COALESCE(m.cost_price, 0)), 0)::NUMERIC AS total_cost_value,
        COALESCE(SUM(m.stock_quantity * m.unit_price), 0)::NUMERIC AS total_selling_value,
        CASE 
            WHEN COALESCE(SUM(m.stock_quantity * COALESCE(m.cost_price, 0)), 0) > 0 
            THEN ((COALESCE(SUM(m.stock_quantity * m.unit_price), 0) - COALESCE(SUM(m.stock_quantity * COALESCE(m.cost_price, 0)), 0)) / COALESCE(SUM(m.stock_quantity * COALESCE(m.cost_price, 0)), 1)) * 100
            ELSE 0
        END::NUMERIC AS total_profit_margin,
        COUNT(*)::BIGINT AS medication_count
    FROM medications m
    WHERE m.stock_quantity > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get medications needing reorder (based on min_stock_level)
CREATE OR REPLACE FUNCTION get_medications_needing_reorder()
RETURNS TABLE (
    medication_id UUID,
    medication_name VARCHAR,
    current_stock INTEGER,
    min_stock_level INTEGER,
    reorder_level INTEGER,
    suggested_order_quantity INTEGER,
    days_since_last_restock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS medication_id,
        m.name AS medication_name,
        m.stock_quantity AS current_stock,
        m.min_stock_level,
        m.reorder_level,
        CASE 
            WHEN m.max_stock_level IS NOT NULL 
            THEN GREATEST(m.max_stock_level - m.stock_quantity, m.reorder_level - m.stock_quantity)
            ELSE GREATEST(m.reorder_level * 2 - m.stock_quantity, m.reorder_level - m.stock_quantity)
        END AS suggested_order_quantity,
        CASE 
            WHEN m.last_restocked_at IS NOT NULL 
            THEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - m.last_restocked_at))::INTEGER
            ELSE NULL
        END AS days_since_last_restock
    FROM medications m
    WHERE m.stock_quantity <= COALESCE(m.min_stock_level, m.reorder_level)
    ORDER BY (m.stock_quantity::NUMERIC / NULLIF(GREATEST(m.min_stock_level, m.reorder_level, 1), 0)) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

