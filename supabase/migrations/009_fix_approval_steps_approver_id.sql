-- approval_steps.approver_id 타입을 uuid → bigint로 변경
-- app_users.id가 bigserial(bigint)이므로 타입 일치를 위해 변경

ALTER TABLE approval_steps
  ALTER COLUMN approver_id TYPE bigint USING approver_id::text::bigint;
