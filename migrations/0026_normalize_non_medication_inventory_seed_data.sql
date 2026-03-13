BEGIN;

-- Consolidate the duplicated ultrasound scanner family into a single SKU-style record.
WITH ultrasound_family AS (
  SELECT
    id,
    item_name,
    stock_quantity,
    description,
    location,
    last_restocked_at,
    created_at,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN item_name = 'Ultrasound Scanner' THEN 0 ELSE 1 END,
        CASE WHEN location IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
    ) AS keep_rank
  FROM non_medication_inventory
  WHERE regexp_replace(lower(item_name), '[^a-z0-9]+', '', 'g') IN ('ultrasoundscan', 'ultrasoundscanner')
), ultrasound_summary AS (
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE item_name = 'Ultrasound Scanner') > 0
        THEN MAX(stock_quantity) FILTER (WHERE item_name = 'Ultrasound Scanner')
      ELSE COALESCE(SUM(stock_quantity), 0)
    END AS canonical_stock,
    COALESCE(MAX(NULLIF(location, '')), 'Scan Room') AS canonical_location,
    COALESCE(MAX(NULLIF(description, '')), 'Ultrasound scanner with three probes.') AS canonical_description,
    COALESCE(MAX(last_restocked_at), CURRENT_TIMESTAMP) AS latest_restocked_at
  FROM ultrasound_family
), keeper AS (
  SELECT
    family.id AS keeper_id,
    summary.canonical_stock,
    summary.canonical_location,
    summary.canonical_description,
    summary.latest_restocked_at
  FROM ultrasound_family family
  CROSS JOIN ultrasound_summary summary
  WHERE family.keep_rank = 1
)
UPDATE non_medication_inventory inventory
SET item_name = 'Ultrasound Scanner',
    item_type = 'Diagnostic Equipment',
    item_subtype = NULL,
    description = keeper.canonical_description,
    location = keeper.canonical_location,
    stock_quantity = keeper.canonical_stock,
    last_restocked_at = keeper.latest_restocked_at,
    updated_at = CURRENT_TIMESTAMP
FROM keeper
WHERE inventory.id = keeper.keeper_id;

WITH keeper AS (
  SELECT id AS keeper_id
  FROM non_medication_inventory
  WHERE regexp_replace(lower(item_name), '[^a-z0-9]+', '', 'g') IN ('ultrasoundscan', 'ultrasoundscanner')
  ORDER BY
    CASE WHEN item_name = 'Ultrasound Scanner' THEN 0 ELSE 1 END,
    CASE WHEN location IS NOT NULL THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1
)
DELETE FROM non_medication_inventory inventory
USING keeper
WHERE regexp_replace(lower(inventory.item_name), '[^a-z0-9]+', '', 'g') IN ('ultrasoundscan', 'ultrasoundscanner')
  AND inventory.id <> keeper.keeper_id;

-- Record the stock correction caused by duplicate consolidation.
INSERT INTO non_medication_stock_movements (
  item_id,
  movement_type,
  quantity,
  reference,
  notes
)
SELECT
  inventory.id,
  'Adjust',
  GREATEST(inventory.stock_quantity - 1, 0),
  'Inventory normalization',
  'Merged duplicate ultrasound inventory records into a single SKU.'
FROM non_medication_inventory inventory
WHERE inventory.item_name = 'Ultrasound Scanner'
  AND inventory.stock_quantity > 1
  AND NOT EXISTS (
    SELECT 1
    FROM non_medication_stock_movements movement
    WHERE movement.item_id = inventory.id
      AND movement.reference = 'Inventory normalization'
      AND movement.notes = 'Merged duplicate ultrasound inventory records into a single SKU.'
  );

-- Correct obvious naming, categorization, and location mistakes.
UPDATE non_medication_inventory
SET item_name = 'Automatic 3-part Hematology Analyzer',
    model_number = COALESCE(model_number, 'ELK 3800'),
    description = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Automatic 3-part Heamatology Analyzer';

UPDATE non_medication_inventory
SET item_name = 'Automatic Voltage Regulator',
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Automatic voltage Regulator';

UPDATE non_medication_inventory
SET item_name = 'Wheelchair',
    manufacturer = COALESCE(manufacturer, 'Elektro Genesis'),
    description = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Wheel chair';

UPDATE non_medication_inventory
SET item_name = 'Laboratory Fridge',
    manufacturer = COALESCE(manufacturer, 'CHIQ'),
    model_number = COALESCE(model_number, 'CTM110D5K3'),
    serial_number = COALESCE(NULLIF(regexp_replace(serial_number, '^SN:\\s*', '', 'i'), ''), serial_number),
    description = 'Silver laboratory refrigerator',
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Laboratory Fridge. CHIQ';

UPDATE non_medication_inventory
SET manufacturer = COALESCE(manufacturer, 'Elektro Genesis'),
    description = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Autoclave'
  AND description = 'Elektro Genesis';

UPDATE non_medication_inventory
SET model_number = COALESCE(model_number, 'ELK 107BN'),
    description = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Light Microscope'
  AND description = 'ELK 107BN';

UPDATE non_medication_inventory
SET model_number = COALESCE(model_number, 'DY-HSCL-001'),
    description = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Height-Weight Scale'
  AND description = 'DY-HSCL-001';

UPDATE non_medication_inventory
SET item_type = 'Office Supplies',
    location = 'Treatment Room',
    updated_at = CURRENT_TIMESTAMP
WHERE item_name = 'Electric Kettle'
  AND item_type = 'Personal Protective Gear';

UPDATE non_medication_inventory
SET location = 'Laboratory',
    updated_at = CURRENT_TIMESTAMP
WHERE location = 'Laboartory';

UPDATE non_medication_inventory
SET location = 'Treatment Room',
    updated_at = CURRENT_TIMESTAMP
WHERE location IN ('Traetment Room', 'Treatment room');

UPDATE non_medication_inventory
SET location = 'Pharmacy Store',
    updated_at = CURRENT_TIMESTAMP
WHERE location = 'Pharmacy store';

COMMIT;
