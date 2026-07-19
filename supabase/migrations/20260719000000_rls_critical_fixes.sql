-- RLS critical fixes — findings from the 2026-07-19 dashboard policy audit
-- (docs/review-todo.md → RLS dashboard check). Two silent app-breaking gaps,
-- one cleanup, one guardrail, one forgery hole:
--
--   1. group_members had no UPDATE policy → accept-invite (client-side
--      UPDATE status 'pending'→'active') matched 0 rows with no error.
--   2. expense_splits had no DELETE policy → expense edit's
--      delete-then-reinsert kept the old splits and doubled balances.
--   3. One soft-deleted expense already carries duplicated splits from (2);
--      dedupe it. Guard: abort if any LIVE expense has duplicates — those
--      need manual reconciliation, not blind dedupe.
--   4. UNIQUE (expense_id, group_member_id) so any future silent no-op
--      becomes a loud insert error instead of corruption.
--   5. notifications INSERT policy dropped — all inserts go through
--      SECURITY DEFINER triggers, so the only thing the policy enabled
--      was forged notifications to arbitrary recipients.

-- ── 1. Accept invite / leave group ─────────────────────────────────────────
-- Own row only; new row must stay own and may only move to active/left —
-- no self re-pending, no reassigning the row to another user or group.
CREATE POLICY "group_members: self can update status" ON group_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('active', 'left'));

-- ── 2. Expense edit (delete-then-reinsert) ─────────────────────────────────
-- Same scope as the existing INSERT policy. UPDATE intentionally omitted:
-- the app's only write pattern is delete + reinsert.
CREATE POLICY "expense_splits: group members can delete" ON expense_splits
  FOR DELETE
  USING (
    expense_id IN (
      SELECT id FROM expenses
      WHERE group_id IN (SELECT get_my_group_ids())
    )
  );

-- ── 3. Dedupe existing corruption (soft-deleted expenses only) ─────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expense_splits s
    JOIN expenses e ON e.id = s.expense_id
    WHERE e.deleted_at IS NULL
    GROUP BY s.expense_id, s.group_member_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'live expenses have duplicate splits — reconcile manually before applying';
  END IF;
END $$;

-- Duplicates only exist on soft-deleted expenses (guarded above), which are
-- excluded from all balance math — keeping an arbitrary row of each pair is
-- safe and only affects the historical display of a deleted expense.
DELETE FROM expense_splits a
USING expense_splits b
WHERE a.expense_id = b.expense_id
  AND a.group_member_id = b.group_member_id
  AND a.ctid > b.ctid;

-- ── 4. Guardrail: one split per member per expense, enforced by the DB ─────
ALTER TABLE expense_splits
  ADD CONSTRAINT expense_splits_expense_member_unique
  UNIQUE (expense_id, group_member_id);

-- ── 5. Notifications are trigger-written only ──────────────────────────────
DROP POLICY IF EXISTS "notifications: anyone can insert" ON notifications;
