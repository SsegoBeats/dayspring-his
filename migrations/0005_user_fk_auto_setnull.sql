-- Normalize any remaining foreign keys that reference users(id)
-- to allow hard deletion of users. This is defensive and idempotent.

DO $$
DECLARE
  rec RECORD;
  fk_name TEXT;
  tgt_table TEXT;
  tgt_column TEXT;
  del_rule TEXT;
BEGIN
  FOR rec IN
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
  LOOP
    fk_name := rec.constraint_name;
    tgt_table := rec.table_name;
    tgt_column := rec.column_name;
    del_rule := rec.delete_rule;

    -- Keep CASCADE where appropriate (schedules/tokens), normalize others
    IF tgt_table IN ('doctor_schedules', 'password_reset_tokens', 'email_verification_tokens') THEN
      CONTINUE;
    END IF;

    IF del_rule IS DISTINCT FROM 'SET NULL' THEN
      -- Allow nulls on the referencing column
      BEGIN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', tgt_table, tgt_column);
      EXCEPTION WHEN others THEN NULL;
      END;
      -- Drop and recreate FK with ON DELETE SET NULL
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tgt_table, fk_name);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL', tgt_table, fk_name, tgt_column);
    END IF;
  END LOOP;
END$$;

