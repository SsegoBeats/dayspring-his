-- Add Office Supplies category and item_subtype to non_medication_inventory

-- Drop existing CHECK on item_type so we can add 'Office Supplies'
ALTER TABLE non_medication_inventory
  DROP CONSTRAINT IF EXISTS non_medication_inventory_item_type_check;

-- Re-add CHECK with Office Supplies included
ALTER TABLE non_medication_inventory
  ADD CONSTRAINT non_medication_inventory_item_type_check
  CHECK (item_type IN (
    'Medical Equipment',
    'Personal Protective Gear',
    'Patient Care Items',
    'Diagnostic Equipment',
    'Surgical & Procedure Equipment',
    'Consumables and Supplies',
    'Office Supplies'
  ));

-- Add optional subtype column for suggested items (e.g. Books, Desks, Keyboards)
ALTER TABLE non_medication_inventory
  ADD COLUMN IF NOT EXISTS item_subtype VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_non_med_inventory_subtype ON non_medication_inventory(item_subtype);
