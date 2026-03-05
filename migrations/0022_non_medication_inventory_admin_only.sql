-- Non-medication inventory: Hospital Administrator only (Pharmacist owns medication inventory only)
-- Replaces previous policies that allowed Pharmacist and others.

-- non_medication_inventory
DROP POLICY IF EXISTS nonmedinv_select ON non_medication_inventory;
CREATE POLICY nonmedinv_select ON non_medication_inventory
  FOR SELECT
  USING (current_setting('app.role', true) = 'Hospital Admin');

DROP POLICY IF EXISTS nonmedinv_insert ON non_medication_inventory;
CREATE POLICY nonmedinv_insert ON non_medication_inventory
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'Hospital Admin');

DROP POLICY IF EXISTS nonmedinv_update ON non_medication_inventory;
CREATE POLICY nonmedinv_update ON non_medication_inventory
  FOR UPDATE
  USING (current_setting('app.role', true) = 'Hospital Admin');

DROP POLICY IF EXISTS nonmedinv_delete ON non_medication_inventory;
CREATE POLICY nonmedinv_delete ON non_medication_inventory
  FOR DELETE
  USING (current_setting('app.role', true) = 'Hospital Admin');

-- non_medication_stock_movements
DROP POLICY IF EXISTS nonmedmov_select ON non_medication_stock_movements;
CREATE POLICY nonmedmov_select ON non_medication_stock_movements
  FOR SELECT
  USING (current_setting('app.role', true) = 'Hospital Admin');

DROP POLICY IF EXISTS nonmedmov_insert ON non_medication_stock_movements;
CREATE POLICY nonmedmov_insert ON non_medication_stock_movements
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'Hospital Admin');

-- non_medication_stock_taking
DROP POLICY IF EXISTS nonmedtaking_select ON non_medication_stock_taking;
CREATE POLICY nonmedtaking_select ON non_medication_stock_taking
  FOR SELECT
  USING (current_setting('app.role', true) = 'Hospital Admin');

DROP POLICY IF EXISTS nonmedtaking_insert ON non_medication_stock_taking;
CREATE POLICY nonmedtaking_insert ON non_medication_stock_taking
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'Hospital Admin');

DROP POLICY IF EXISTS nonmedtaking_update ON non_medication_stock_taking;
CREATE POLICY nonmedtaking_update ON non_medication_stock_taking
  FOR UPDATE
  USING (current_setting('app.role', true) = 'Hospital Admin');
