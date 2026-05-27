-- Migration: handle, group_members status, expense_history, notification triggers
-- Paste into Supabase SQL Editor and run.

-- ─────────────────────────────────────────────
-- 1. profiles.handle
-- ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles (lower(handle));

-- ─────────────────────────────────────────────
-- 2. group_members: status + invited_by
-- ─────────────────────────────────────────────
-- Add with DEFAULT 'active' so existing rows are backfilled as active.
-- Then change the default to 'pending' so future inserts must be explicit.
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'left')),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles (id);

ALTER TABLE group_members
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_members (group_id, status);

-- ─────────────────────────────────────────────
-- 3. expenses.split_type: add 'percentage'
-- ─────────────────────────────────────────────
-- The auto-generated constraint name is typically expenses_split_type_check.
-- If this fails, check the real name with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'expenses'::regclass AND contype = 'c';
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_split_type_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_split_type_check
    CHECK (split_type IN ('equal', 'exact', 'percentage', 'itemized'));

-- ─────────────────────────────────────────────
-- 4. expense_history table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID REFERENCES expenses (id) ON DELETE CASCADE NOT NULL,
  edited_by   UUID REFERENCES profiles (id) NOT NULL,
  snapshot    JSONB NOT NULL,
  edited_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expense_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members can view expense history"
  ON expense_history FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT group_id FROM group_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ─────────────────────────────────────────────
-- 5. notifications: add group_id + expand type check
-- ─────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups (id) ON DELETE CASCADE;

-- Drop old constraint and replace with expanded version
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'group_invite',
      'group_invite_accepted',
      'group_invite_declined',
      'settlement_confirm',
      'settlement_confirmed',
      'settlement_denied'
    ));

-- ─────────────────────────────────────────────
-- 6. Notification triggers (all 6 cases)
-- ─────────────────────────────────────────────

-- 6a. Invite sent — INSERT with status = 'pending'
CREATE OR REPLACE FUNCTION notify_group_invite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite', NEW.user_id, NEW.group_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_group_member_inserted ON group_members;
CREATE TRIGGER on_group_member_inserted
  AFTER INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION notify_group_invite();

-- 6b. Invite accepted — UPDATE pending → active
CREATE OR REPLACE FUNCTION notify_group_invite_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'active' AND OLD.invited_by IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite_accepted', OLD.invited_by, OLD.group_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_group_member_updated ON group_members;
CREATE TRIGGER on_group_member_updated
  AFTER UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION notify_group_invite_accepted();

-- 6c. Invite declined — DELETE where OLD.status = 'pending'
CREATE OR REPLACE FUNCTION notify_group_invite_declined()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND OLD.invited_by IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite_declined', OLD.invited_by, OLD.group_id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_group_member_deleted ON group_members;
CREATE TRIGGER on_group_member_deleted
  AFTER DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION notify_group_invite_declined();

-- 6d. Settlement recorded — always notify payee
CREATE OR REPLACE FUNCTION notify_settlement_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (type, recipient_id, settlement_id)
  VALUES ('settlement_confirm', NEW.to_user, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_settlement_inserted ON settlements;
CREATE TRIGGER on_settlement_inserted
  AFTER INSERT ON settlements
  FOR EACH ROW EXECUTE FUNCTION notify_settlement_created();

-- 6e. Settlement confirmed — notify payer
CREATE OR REPLACE FUNCTION notify_settlement_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (type, recipient_id, settlement_id)
    VALUES ('settlement_confirmed', NEW.from_user, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_settlement_updated ON settlements;
CREATE TRIGGER on_settlement_updated
  AFTER UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION notify_settlement_confirmed();

-- 6f. Settlement denied — notify payer
CREATE OR REPLACE FUNCTION notify_settlement_denied()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' THEN
    INSERT INTO notifications (type, recipient_id, settlement_id)
    VALUES ('settlement_denied', OLD.from_user, OLD.id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_settlement_deleted ON settlements;
CREATE TRIGGER on_settlement_deleted
  AFTER DELETE ON settlements
  FOR EACH ROW EXECUTE FUNCTION notify_settlement_denied();

-- ─────────────────────────────────────────────
-- 7. expense_history trigger (log before every UPDATE)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_expense_edit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_history (expense_id, edited_by, snapshot)
  VALUES (OLD.id, auth.uid(), to_jsonb(OLD));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS expense_before_update ON expenses;
CREATE TRIGGER expense_before_update
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION log_expense_edit();
