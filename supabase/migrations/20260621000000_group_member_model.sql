-- Migration: group_member_model
-- Restructures identity so group_members.id is the key for all group-scoped
-- operations. Profiles remain the identity for cross-group concerns (auth,
-- search, notifications). Guests are just names on group_members rows —
-- no profile row needed until they claim.
--
-- NOTE: supersedes 20260617000000_create_group_with_members.sql (RPC approach
-- abandoned in favour of this schema change).
--
-- Tables changed:
--   group_members  — surrogate PK, name column, user_id nullable
--   expense_splits — user_id → group_member_id
--   expenses       — paid_by → group_members (was profiles)
--   settlements    — from_user/to_user → from_member_id/to_member_id
--   triggers       — settlement triggers resolve profile via group_members.user_id
--                    group_invite trigger guards against null user_id (guests)

-- ─────────────────────────────────────────────
-- 1. group_members — surrogate PK + name + nullable user_id
-- ─────────────────────────────────────────────

ALTER TABLE group_members ADD COLUMN id uuid DEFAULT gen_random_uuid();
UPDATE group_members SET id = gen_random_uuid();
ALTER TABLE group_members ALTER COLUMN id SET NOT NULL;

ALTER TABLE group_members ADD COLUMN name text;
UPDATE group_members gm
SET name = COALESCE(p.display_name, p.name)
FROM profiles p
WHERE p.id = gm.user_id;
UPDATE group_members SET name = 'Unknown' WHERE name IS NULL;
ALTER TABLE group_members ALTER COLUMN name SET NOT NULL;

ALTER TABLE group_members DROP CONSTRAINT group_members_pkey;
ALTER TABLE group_members ADD PRIMARY KEY (id);

-- Partial unique index — only one row per real user per group
-- Guests (user_id IS NULL) are excluded so multiple guests can exist in one group
CREATE UNIQUE INDEX group_members_group_user_unique
  ON group_members (group_id, user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE group_members ALTER COLUMN user_id DROP NOT NULL;

-- ─────────────────────────────────────────────
-- 2. expense_splits — user_id → group_member_id
-- ─────────────────────────────────────────────

ALTER TABLE expense_splits ADD COLUMN group_member_id uuid;

UPDATE expense_splits es
SET group_member_id = gm.id
FROM expenses e, group_members gm
WHERE es.expense_id = e.id
  AND gm.group_id = e.group_id
  AND gm.user_id = es.user_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM expense_splits WHERE group_member_id IS NULL) THEN
    RAISE EXCEPTION 'expense_splits: some rows could not be mapped to a group_members row';
  END IF;
END $$;

ALTER TABLE expense_splits ALTER COLUMN group_member_id SET NOT NULL;
ALTER TABLE expense_splits
  ADD CONSTRAINT expense_splits_group_member_id_fkey
  FOREIGN KEY (group_member_id) REFERENCES group_members (id) ON DELETE CASCADE;

ALTER TABLE expense_splits DROP COLUMN user_id;

-- ─────────────────────────────────────────────
-- 3. expenses.paid_by — profiles → group_members
-- ─────────────────────────────────────────────

ALTER TABLE expenses ADD COLUMN paid_by_member_id uuid;

UPDATE expenses e
SET paid_by_member_id = gm.id
FROM group_members gm
WHERE gm.group_id = e.group_id AND gm.user_id = e.paid_by;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM expenses WHERE paid_by_member_id IS NULL) THEN
    RAISE EXCEPTION 'expenses: some rows could not be mapped to a group_members row';
  END IF;
END $$;

ALTER TABLE expenses ALTER COLUMN paid_by_member_id SET NOT NULL;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_paid_by_member_id_fkey
  FOREIGN KEY (paid_by_member_id) REFERENCES group_members (id);

-- Drop the RLS policy that depends on paid_by before renaming the column
DROP POLICY IF EXISTS "expenses: paid_by can update" ON expenses;

ALTER TABLE expenses DROP COLUMN paid_by;
ALTER TABLE expenses RENAME COLUMN paid_by_member_id TO paid_by;

-- Recreate the policy — paid_by now references group_members.id, so check
-- whether the current user has a group_members row matching the payer
CREATE POLICY "expenses: paid_by can update" ON expenses FOR UPDATE
  USING (
    paid_by IN (
      SELECT id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 4. settlements — from_user/to_user → from_member_id/to_member_id
-- ─────────────────────────────────────────────

ALTER TABLE settlements ADD COLUMN from_member_id uuid;
ALTER TABLE settlements ADD COLUMN to_member_id uuid;

UPDATE settlements s
SET from_member_id = gm.id
FROM group_members gm
WHERE gm.group_id = s.group_id AND gm.user_id = s.from_user;

UPDATE settlements s
SET to_member_id = gm.id
FROM group_members gm
WHERE gm.group_id = s.group_id AND gm.user_id = s.to_user;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM settlements WHERE from_member_id IS NULL OR to_member_id IS NULL) THEN
    RAISE EXCEPTION 'settlements: some rows could not be mapped to group_members rows';
  END IF;
END $$;

ALTER TABLE settlements ALTER COLUMN from_member_id SET NOT NULL;
ALTER TABLE settlements ALTER COLUMN to_member_id SET NOT NULL;
ALTER TABLE settlements
  ADD CONSTRAINT settlements_from_member_id_fkey
  FOREIGN KEY (from_member_id) REFERENCES group_members (id);
ALTER TABLE settlements
  ADD CONSTRAINT settlements_to_member_id_fkey
  FOREIGN KEY (to_member_id) REFERENCES group_members (id);

-- Drop RLS policies that depend on from_user/to_user before dropping columns
DROP POLICY IF EXISTS "settlements: parties can update" ON settlements;
DROP POLICY IF EXISTS "settlements: parties can delete" ON settlements;

ALTER TABLE settlements DROP COLUMN from_user;
ALTER TABLE settlements DROP COLUMN to_user;

-- Recreate policies — now reference from_member_id/to_member_id
CREATE POLICY "settlements: parties can update" ON settlements FOR UPDATE
  USING (
    from_member_id IN (SELECT id FROM group_members WHERE user_id = auth.uid())
    OR to_member_id IN (SELECT id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "settlements: parties can delete" ON settlements FOR DELETE
  USING (
    from_member_id IN (SELECT id FROM group_members WHERE user_id = auth.uid())
    OR to_member_id IN (SELECT id FROM group_members WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 5. Update notification triggers
-- ─────────────────────────────────────────────

-- Group invite: guests (user_id IS NULL) have no account to notify
CREATE OR REPLACE FUNCTION notify_group_invite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite', NEW.user_id, NEW.group_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION notify_group_invite_declined()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND OLD.user_id IS NOT NULL AND OLD.invited_by IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite_declined', OLD.invited_by, OLD.group_id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Settlement triggers: resolve profile ID via group_members.user_id
-- Only fires if the member has a linked profile (guards against future edge cases)

CREATE OR REPLACE FUNCTION notify_settlement_created()
RETURNS TRIGGER AS $$
DECLARE
  payee_profile_id uuid;
BEGIN
  SELECT user_id INTO payee_profile_id FROM group_members WHERE id = NEW.to_member_id;
  IF payee_profile_id IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, settlement_id)
    VALUES ('settlement_confirm', payee_profile_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_settlement_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  payer_profile_id uuid;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    SELECT user_id INTO payer_profile_id FROM group_members WHERE id = NEW.from_member_id;
    IF payer_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id)
      VALUES ('settlement_confirmed', payer_profile_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_settlement_denied()
RETURNS TRIGGER AS $$
DECLARE
  payer_profile_id uuid;
BEGIN
  IF OLD.status = 'pending' THEN
    SELECT user_id INTO payer_profile_id FROM group_members WHERE id = OLD.from_member_id;
    IF payer_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id)
      VALUES ('settlement_denied', payer_profile_id, OLD.id);
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
