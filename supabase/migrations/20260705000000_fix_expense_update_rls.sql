-- Migration: fix_expense_update_rls
-- "expenses: paid_by can update" (added in 20260621000000_group_member_model.sql)
-- restricts UPDATE — which includes the soft-delete (deleted_at) and all edits —
-- to whoever is paid_by on that specific expense. Per CLAUDE.md, any active
-- group member must be able to edit or delete any expense in the group.
--
-- Because RLS silently filters rows rather than erroring, this made delete/edit
-- appear to succeed (no error returned) while doing nothing for anyone but the
-- original payer.

DROP POLICY IF EXISTS "expenses: paid_by can update" ON expenses;

CREATE POLICY "expenses: group members can update" ON expenses FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );
