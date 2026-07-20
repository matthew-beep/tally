-- RLS follow-up tightenings — remaining findings from the 2026-07-19 audit
-- (docs/review-todo.md → RLS dashboard check + Phase 2 API-route read).
--
-- Ships as a unit with the API-route hardening (membership check +
-- service-role writes in members/add, batch split in groups/create,
-- getUser() everywhere). The new routes work under the old policies, but
-- the old routes break under these — deploy routes first.
--
--   1. get_my_group_ids() filters status = 'active' — pending and left
--      members lose read access to group money data (the consent gate,
--      now enforced at the DB).
--   2. Own-row SELECT on group_members — without it, (1) breaks the
--      decline route's membership check and the invite page's pending
--      lookup (a pending member must see their own row).
--   3. Pending-invitee preview on groups — without it, (1) blanks the
--      group name in invite notifications (the group:groups(...) join in
--      useNotifications resolves under the invitee's RLS).
--   4. group_members INSERT tightened to self-only. Was: any authed user
--      could insert any membership row into any group. Invite-link
--      self-join keeps working; invites/guests go through service-role
--      API routes.
--   5. group_members client DELETE dropped. Leave = UPDATE to 'left'
--      (self-update policy, 20260719000000); decline = service role.
--      A client DELETE cascades into expense_splits and corrupts history.
--   6. Settlement confirm is payee-only. Was: either party could UPDATE,
--      so a payer could self-confirm their own payment. DELETE stays
--      either-party (payer-undo / payee-deny are both legitimate).

-- ── 1. Membership helper: active members only ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT group_id FROM public.group_members
  WHERE user_id = auth.uid() AND status = 'active'
$$;

-- ── 2. A member can always see their own membership rows ───────────────────
CREATE POLICY "group_members: own row" ON group_members
  FOR SELECT USING (user_id = auth.uid());

-- ── 3. A pending invitee can read the invited group's row (name/emoji) ─────
CREATE POLICY "groups: pending invitee can preview" ON groups
  FOR SELECT USING (id IN (
    SELECT group_id FROM group_members
    WHERE user_id = auth.uid() AND status = 'pending'
  ));

-- ── 4. Membership inserts: self-join only ──────────────────────────────────
DROP POLICY IF EXISTS "group_members: authenticated can join" ON group_members;
CREATE POLICY "group_members: self join" ON group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 5. No client-side membership deletes ───────────────────────────────────
DROP POLICY IF EXISTS "group_members: can leave" ON group_members;

-- ── 6. Only the payee can confirm a settlement ─────────────────────────────
DROP POLICY IF EXISTS "settlements: parties can update" ON settlements;
CREATE POLICY "settlements: payee can update" ON settlements
  FOR UPDATE USING (
    to_member_id IN (
      SELECT id FROM group_members WHERE user_id = auth.uid()
    )
  );
