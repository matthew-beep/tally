-- Migration: fix_expense_select_rls
-- "expenses: group members only" (SELECT) requires deleted_at IS NULL. This
-- conflates a data-visibility rule with an access-control rule: the instant a
-- soft-delete UPDATE sets deleted_at, the resulting row stops matching the
-- SELECT policy, and Postgres rejects the UPDATE that produced it —
-- "new row violates row-level security policy for table expenses" — even
-- though the UPDATE policy itself (group membership) is satisfied.
--
-- Confirmed via a rolled-back manual test: removing deleted_at IS NULL from
-- this policy alone (independent of the UPDATE policy's USING/WITH CHECK)
-- allowed the soft-delete to succeed.
--
-- deleted_at IS NULL filtering already happens at the query layer per
-- CLAUDE.md (useExpenses, useGlobalBalances, useRecentActivity, useAllActivity,
-- calcNetBalances all filter it explicitly) — RLS only needs to gate on group
-- membership.

DROP POLICY IF EXISTS "expenses: group members only" ON expenses;

CREATE POLICY "expenses: group members only" ON expenses FOR SELECT
  USING (
    group_id IN (SELECT get_my_group_ids())
  );
