-- Medication Categories and Non-Medication Inventory
-- This migration adds predefined medication categories and creates inventory system for non-medication items

-- Create medication_categories reference table with predefined categories
CREATE TABLE IF NOT EXISTS medication_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert predefined medication categories
INSERT INTO medication_categories (name, description) VALUES
    ('Antimalarials', 'Medications used to prevent and treat malaria'),
    ('Antidepressants', 'Medications used to treat depression and mood disorders'),
    ('Anticoagulants', 'Medications that prevent blood clotting'),
    ('Antibiotics', 'Medications used to treat bacterial infections'),
    ('Antivirals', 'Medications used to treat viral infections'),
    ('Antifungals', 'Medications used to treat fungal infections'),
    ('Analgesics', 'Pain relief medications'),
    ('Antipyretics', 'Fever-reducing medications'),
    ('Antihypertensives', 'Medications for high blood pressure'),
    ('Antidiabetics', 'Medications for diabetes management'),
    ('Cardiovascular', 'Heart and blood vessel medications'),
    ('Respiratory', 'Medications for respiratory conditions'),
    ('Gastrointestinal', 'Medications for digestive system'),
    ('Neurological', 'Medications for nervous system disorders'),
    ('Hormonal', 'Hormone-related medications'),
    ('Vitamins & Supplements', 'Vitamins and nutritional supplements'),
    ('Vaccines', 'Immunization vaccines'),
    ('Antiseptics & Disinfectants', 'Cleaning and sterilization agents'),
    ('Topical', 'Medications applied to skin'),
    ('Ophthalmic', 'Eye medications'),
    ('Ear Medications', 'Ear drops and treatments'),
    ('Other', 'Other medications not categorized above')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_medication_categories_name ON medication_categories(name);

-- Add foreign key constraint to medications.category (optional, for data integrity)
-- Note: We'll keep category as VARCHAR for backward compatibility but add validation

-- Create non_medication_inventory table for non-medication stock items
CREATE TABLE IF NOT EXISTS non_medication_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(100) NOT NULL CHECK (item_type IN (
        'Medical Equipment',
        'Personal Protective Gear',
        'Patient Care Items',
        'Diagnostic Equipment',
        'Surgical & Procedure Equipment',
        'Consumables and Supplies'
    )),
    description TEXT,
    manufacturer VARCHAR(255),
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'units',
    unit_price NUMERIC(10,2),
    cost_price NUMERIC(10,2),
    reorder_level INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    location VARCHAR(255),
    barcode VARCHAR(100),
    expiry_date DATE,
    last_restocked_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_non_med_inventory_type ON non_medication_inventory(item_type);
CREATE INDEX IF NOT EXISTS idx_non_med_inventory_name ON non_medication_inventory(item_name);
CREATE INDEX IF NOT EXISTS idx_non_med_inventory_barcode ON non_medication_inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_non_med_inventory_location ON non_medication_inventory(location);

-- Create non_medication_stock_movements table for tracking movements
CREATE TABLE IF NOT EXISTS non_medication_stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES non_medication_inventory(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('Receive','Adjust','Issue','Return','Dispose')),
    quantity INTEGER NOT NULL,
    reference TEXT,
    notes TEXT,
    barcode_snapshot VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_non_med_stock_movements_item ON non_medication_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_non_med_stock_movements_type ON non_medication_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_non_med_stock_movements_created ON non_medication_stock_movements(created_at DESC);

-- Create non_medication_stock_taking table for physical inventory counts
CREATE TABLE IF NOT EXISTS non_medication_stock_taking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES non_medication_inventory(id) ON DELETE CASCADE,
    recorded_quantity INTEGER NOT NULL CHECK (recorded_quantity >= 0),
    system_quantity INTEGER NOT NULL CHECK (system_quantity >= 0),
    variance INTEGER NOT NULL,
    notes TEXT,
    taken_by UUID REFERENCES users(id),
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected'))
);

CREATE INDEX IF NOT EXISTS idx_non_med_stock_taking_item ON non_medication_stock_taking(item_id);
CREATE INDEX IF NOT EXISTS idx_non_med_stock_taking_taken_at ON non_medication_stock_taking(taken_at);
CREATE INDEX IF NOT EXISTS idx_non_med_stock_taking_status ON non_medication_stock_taking(status);

-- Enable RLS for non-medication inventory tables
ALTER TABLE non_medication_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_medication_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_medication_stock_taking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for non_medication_inventory
DROP POLICY IF EXISTS nonmedinv_select ON non_medication_inventory;
CREATE POLICY nonmedinv_select ON non_medication_inventory
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist','Nurse','Doctor','Midwife','Dentist'));

DROP POLICY IF EXISTS nonmedinv_insert ON non_medication_inventory;
CREATE POLICY nonmedinv_insert ON non_medication_inventory
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS nonmedinv_update ON non_medication_inventory;
CREATE POLICY nonmedinv_update ON non_medication_inventory
  FOR UPDATE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS nonmedinv_delete ON non_medication_inventory;
CREATE POLICY nonmedinv_delete ON non_medication_inventory
  FOR DELETE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- RLS Policies for non_medication_stock_movements
DROP POLICY IF EXISTS nonmedmov_select ON non_medication_stock_movements;
CREATE POLICY nonmedmov_select ON non_medication_stock_movements
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS nonmedmov_insert ON non_medication_stock_movements;
CREATE POLICY nonmedmov_insert ON non_medication_stock_movements
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- RLS Policies for non_medication_stock_taking
DROP POLICY IF EXISTS nonmedtaking_select ON non_medication_stock_taking;
CREATE POLICY nonmedtaking_select ON non_medication_stock_taking
  FOR SELECT
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS nonmedtaking_insert ON non_medication_stock_taking;
CREATE POLICY nonmedtaking_insert ON non_medication_stock_taking
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

DROP POLICY IF EXISTS nonmedtaking_update ON non_medication_stock_taking;
CREATE POLICY nonmedtaking_update ON non_medication_stock_taking
  FOR UPDATE
  USING (current_setting('app.role', true) IN ('Hospital Admin','Pharmacist'));

-- Add trigger to update updated_at for non_medication_inventory
DROP TRIGGER IF EXISTS update_non_med_inventory_updated_at ON non_medication_inventory;
CREATE TRIGGER update_non_med_inventory_updated_at
    BEFORE UPDATE ON non_medication_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
