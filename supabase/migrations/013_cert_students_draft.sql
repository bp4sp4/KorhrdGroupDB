ALTER TABLE cert_students ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;
