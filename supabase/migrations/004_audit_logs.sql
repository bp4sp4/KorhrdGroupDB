CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL, -- 'CREATE','UPDATE','DELETE','APPROVE','REJECT','EXPORT'
  target_type text NOT NULL, -- 'revenues','approvals','expenses'
  target_id uuid,
  changes jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
