CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS loinc_tests (
  loinc_code VARCHAR(20) PRIMARY KEY,
  component TEXT,
  property TEXT,
  time_aspct TEXT,
  system TEXT,
  scale_typ TEXT,
  method_typ TEXT,
  class TEXT,
  classtype INTEGER,
  long_common_name TEXT,
  shortname TEXT,
  units TEXT,
  example_units TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_specimen_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_specimens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES lab_specimen_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_specimen_tests (
  specimen_id UUID NOT NULL REFERENCES lab_specimens(id) ON DELETE CASCADE,
  loinc_code VARCHAR(20) NOT NULL REFERENCES loinc_tests(loinc_code) ON DELETE CASCADE,
  PRIMARY KEY (specimen_id, loinc_code)
);

CREATE INDEX IF NOT EXISTS idx_lab_specimens_category
  ON lab_specimens(category_id, display_order, name);

INSERT INTO lab_specimen_categories (name, display_order)
SELECT defaults.name, defaults.display_order
FROM (VALUES
  ('Blood', 1),
  ('Urine', 2),
  ('Stool', 3),
  ('Swab', 4),
  ('Sputum', 5),
  ('Cerebrospinal fluid', 6),
  ('Other body fluids', 7),
  ('Other specimens', 8)
) AS defaults(name, display_order)
WHERE NOT EXISTS (SELECT 1 FROM lab_specimen_categories)
ON CONFLICT (name) DO NOTHING;

INSERT INTO lab_specimens (category_id, name, display_order)
SELECT c.id, s.name, s.display_order
FROM (VALUES
  ('Blood', 'Blood', 1),
  ('Blood', 'Whole Blood', 2),
  ('Blood', 'Serum', 3),
  ('Blood', 'Plasma', 4),
  ('Blood', 'Bone Marrow', 5),
  ('Urine', 'Urine', 1),
  ('Urine', 'Midstream Urine', 2),
  ('Stool', 'Stool', 1),
  ('Swab', 'Wound Swab', 1),
  ('Swab', 'Nasopharyngeal Swab', 2),
  ('Swab', 'Throat Swab', 3),
  ('Swab', 'Vaginal Swab', 4),
  ('Swab', 'Cervical Swab', 5),
  ('Swab', 'Urethral Swab', 6),
  ('Swab', 'Rectal Swab', 7),
  ('Swab', 'Ear Swab', 8),
  ('Swab', 'Eye Swab', 9),
  ('Swab', 'Nasal Swab', 10),
  ('Sputum', 'Sputum', 1),
  ('Sputum', 'Bronchoalveolar Lavage', 2),
  ('Cerebrospinal fluid', 'CSF', 1),
  ('Other body fluids', 'Pleural Fluid', 1),
  ('Other body fluids', 'Ascitic Fluid', 2),
  ('Other body fluids', 'Pericardial Fluid', 3),
  ('Other body fluids', 'Synovial Fluid', 4),
  ('Other body fluids', 'Amniotic Fluid', 5),
  ('Other body fluids', 'Joint Fluid', 6),
  ('Other body fluids', 'Bile', 7),
  ('Other body fluids', 'Gastric Aspirate', 8),
  ('Other body fluids', 'Peritoneal Fluid', 9),
  ('Other body fluids', 'Body Fluid', 10),
  ('Other body fluids', 'Other fluid', 11),
  ('Other specimens', 'Saliva', 1),
  ('Other specimens', 'Semen', 2),
  ('Other specimens', 'Tissue', 3),
  ('Other specimens', 'Other specimen', 4)
) AS s(category_name, name, display_order)
JOIN lab_specimen_categories c ON c.name = s.category_name
WHERE NOT EXISTS (SELECT 1 FROM lab_specimens)
ON CONFLICT (name) DO NOTHING;

INSERT INTO lab_specimen_tests (specimen_id, loinc_code)
SELECT s.id, l.loinc_code
FROM lab_specimens s
JOIN loinc_tests l ON
  (s.name IN ('Blood', 'Whole Blood') AND (l.system ILIKE '%bld%' OR l.system ILIKE '%blood%'))
  OR (s.name = 'Blood' AND (l.system ILIKE '%serum%' OR l.system ILIKE '%ser/plas%' OR l.system ILIKE '%plas%'))
  OR (s.name = 'Serum' AND (l.system ILIKE '%serum%' OR l.system ILIKE '%ser/plas%'))
  OR (s.name = 'Plasma' AND l.system ILIKE '%plas%')
  OR (s.name IN ('Urine', 'Midstream Urine') AND l.system ILIKE '%urine%')
  OR (s.name = 'Stool' AND (l.system ILIKE '%stool%' OR l.system ILIKE '%feces%' OR l.system ILIKE '%faeces%'))
  OR (s.name = 'Sputum' AND l.system ILIKE '%sputum%')
  OR (s.name = 'CSF' AND (l.system ILIKE '%csf%' OR l.system ILIKE '%cerebrospinal%'))
WHERE NOT EXISTS (SELECT 1 FROM lab_specimen_tests)
ON CONFLICT DO NOTHING;
