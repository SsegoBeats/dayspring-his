-- migrations/0028_pharmacy_production_ready.sql

-- PO sequence for collision-safe LPO numbers
CREATE SEQUENCE IF NOT EXISTS lpo_sequence START 1;
CREATE SEQUENCE IF NOT EXISTS grn_sequence START 1;

-- Suppliers (admin-managed)
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  nda_license_number text,
  payment_terms text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select_authenticated" ON suppliers FOR SELECT USING (current_setting('app.role', true) IS NOT NULL);
CREATE POLICY "suppliers_insert_admin" ON suppliers FOR INSERT WITH CHECK (current_setting('app.role', true) = 'Hospital Admin');
CREATE POLICY "suppliers_update_admin" ON suppliers FOR UPDATE USING (current_setting('app.role', true) = 'Hospital Admin');
CREATE POLICY "suppliers_delete_admin" ON suppliers FOR DELETE USING (current_setting('app.role', true) = 'Hospital Admin');

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  expected_delivery_date date,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  cancelled_by uuid REFERENCES users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select_pharmacy" ON purchase_orders FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "po_insert_pharmacy" ON purchase_orders FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "po_update_pharmacy" ON purchase_orders FOR UPDATE USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "po_delete_admin" ON purchase_orders FOR DELETE USING (current_setting('app.role', true) = 'Hospital Admin');

-- Purchase order items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id),
  quantity_ordered integer NOT NULL,
  quantity_received integer DEFAULT 0,
  unit_cost numeric(10,2),
  notes text
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poi_select_pharmacy" ON purchase_order_items FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "poi_insert_pharmacy" ON purchase_order_items FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "poi_update_pharmacy" ON purchase_order_items FOR UPDATE USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "poi_delete_pharmacy" ON purchase_order_items FOR DELETE USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- Goods received notes
CREATE TABLE IF NOT EXISTS goods_received_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text UNIQUE NOT NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id),
  supplier_id uuid REFERENCES suppliers(id) NOT NULL,
  invoice_number text,
  received_by uuid REFERENCES users(id) NOT NULL,
  received_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_select_pharmacy" ON goods_received_notes FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "grn_insert_pharmacy" ON goods_received_notes FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- GRN items
CREATE TABLE IF NOT EXISTS grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id) NOT NULL,
  batch_id uuid REFERENCES medication_batches(id),
  batch_number text NOT NULL,
  expiry_date date NOT NULL,
  quantity_ordered integer,
  quantity_received integer NOT NULL,
  unit_cost numeric(10,2)
);

ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_items_select_pharmacy" ON grn_items FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "grn_items_insert_pharmacy" ON grn_items FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- Controlled drug register
CREATE TABLE IF NOT EXISTS controlled_drug_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid REFERENCES medications(id) NOT NULL,
  patient_id uuid REFERENCES patients(id),
  prescription_id uuid REFERENCES prescriptions(id),
  prescriber_name text NOT NULL,
  prescriber_registration_number text,
  quantity_dispensed integer NOT NULL,
  batch_number text,
  running_balance integer NOT NULL,
  dispensed_by uuid REFERENCES users(id) NOT NULL,
  dispensed_at timestamptz DEFAULT now(),
  witness_name text,
  entry_type text DEFAULT 'dispense',
  notes text
);

ALTER TABLE controlled_drug_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cdr_select_pharmacy" ON controlled_drug_register FOR SELECT USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));
CREATE POLICY "cdr_insert_pharmacy" ON controlled_drug_register FOR INSERT WITH CHECK (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

-- Pharmacy settings (per-user)
CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) UNIQUE NOT NULL,
  low_stock_threshold_override integer,
  expiry_warning_days integer DEFAULT 90,
  expiry_critical_days integer DEFAULT 30,
  default_dispensing_notes text,
  preferred_print_format text DEFAULT 'a4',
  print_include_logo boolean DEFAULT true,
  enable_controlled_drug_alerts boolean DEFAULT true,
  notify_low_stock boolean DEFAULT true,
  notify_expiry boolean DEFAULT true,
  notify_new_prescriptions boolean DEFAULT true,
  notify_po_approved boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pharmacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharm_settings_select_own" ON pharmacy_settings FOR SELECT USING (
  current_setting('app.user_id', true) = user_id::text
);
CREATE POLICY "pharm_settings_insert_own" ON pharmacy_settings FOR INSERT WITH CHECK (
  current_setting('app.user_id', true) = user_id::text
);
CREATE POLICY "pharm_settings_update_own" ON pharmacy_settings FOR UPDATE USING (
  current_setting('app.user_id', true) = user_id::text
);

-- Add controlled substance fields to medications
ALTER TABLE medications ADD COLUMN IF NOT EXISTS is_controlled boolean DEFAULT false;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS schedule_class text;

COMMENT ON COLUMN pharmacy_settings.low_stock_threshold_override IS 'Absolute unit count; overrides medications.reorder_level when set. Not a percentage.';
COMMENT ON COLUMN medications.schedule_class IS 'Schedule I | Schedule II | Schedule III | null for non-controlled';

-- ============================================================
-- Code Review Fixes (appended)
-- ============================================================

-- Fix 1: Indexes for FK joins (Critical)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_med ON purchase_order_items(medication_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON goods_received_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_received_notes(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_med ON grn_items(medication_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_batch ON grn_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_cdr_medication ON controlled_drug_register(medication_id);
CREATE INDEX IF NOT EXISTS idx_cdr_patient ON controlled_drug_register(patient_id);
CREATE INDEX IF NOT EXISTS idx_cdr_dispensed_at ON controlled_drug_register(dispensed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdr_prescription ON controlled_drug_register(prescription_id);

-- Fix 2: purchase_orders.supplier_id must not be null (Critical)
ALTER TABLE purchase_orders ALTER COLUMN supplier_id SET NOT NULL;

-- Fix 3: Enum-like CHECK constraints (Important)
ALTER TABLE purchase_orders ADD CONSTRAINT po_status_check
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled'));

ALTER TABLE controlled_drug_register ADD CONSTRAINT cdr_entry_type_check
  CHECK (entry_type IN ('dispense', 'receipt', 'adjustment', 'opening_balance'));

-- Fix 4: Restrict poi_delete policy to drafts only (Important)
DROP POLICY IF EXISTS "poi_delete_pharmacy" ON purchase_order_items;

CREATE POLICY "poi_delete_pharmacy_draft" ON purchase_order_items FOR DELETE
  USING (
    current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin')
    AND (
      SELECT status FROM purchase_orders WHERE id = purchase_order_id
    ) = 'draft'
  );

-- Fix 5: Auto-update updated_at timestamps (Important)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pharmacy_settings_updated_at
  BEFORE UPDATE ON pharmacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fix 6: Tighten suppliers SELECT to pharmacy roles only + clarifying comments (Minor)
DROP POLICY IF EXISTS "suppliers_select_authenticated" ON suppliers;
CREATE POLICY "suppliers_select_pharmacy" ON suppliers FOR SELECT
  USING (current_setting('app.role', true) IN ('Pharmacist', 'Hospital Admin'));

COMMENT ON COLUMN medications.is_controlled IS 'True if this medication is a controlled substance (NDA Schedule I/II/III). Separate from prescriptions.is_controlled_substance which is a per-prescription flag.';
COMMENT ON COLUMN controlled_drug_register.running_balance IS 'Computed server-side on every INSERT by application logic. DO NOT UPDATE directly. Integrity enforced at application layer in /api/pharmacy/dispense.';
