-- Guest-claim flow. A guest is a group_members row with user_id = NULL.
-- seat_token lets that specific seat be claimed without losing the
-- expense_splits/settlements history already attached to it (they key off
-- group_members.id, so claiming is a single UPDATE, not a data migration).
--
-- Generated unconditionally on every row (real members too — permanently
-- inert there), same mechanism as groups.invite_token. This means none of
-- the three places a guest row is created or converted
-- (/api/groups/create, /api/groups/members/add, the decline-to-guest
-- conversion in /api/invite/decline) need any special-casing.
ALTER TABLE "public"."group_members"
  ADD COLUMN "seat_token" "text" DEFAULT substr(md5((random())::"text"), 1, 12);

-- Backfill: the column default only applies to rows inserted after this
-- migration runs, not existing ones.
UPDATE "public"."group_members"
  SET "seat_token" = substr(md5((random())::"text"), 1, 12)
  WHERE "seat_token" IS NULL;

ALTER TABLE "public"."group_members" ALTER COLUMN "seat_token" SET NOT NULL;

ALTER TABLE "public"."group_members"
  ADD CONSTRAINT "group_members_seat_token_key" UNIQUE ("seat_token");

-- Claim preview RPC — mirrors get_group_by_invite_token, same rationale.
-- Never returns group_members.id, invited_by, or any other member's data —
-- just enough to render a preview and distinguish valid / already-claimed.
CREATE OR REPLACE FUNCTION "public"."get_seat_by_claim_token"("token" "text")
RETURNS TABLE(
  "group_id"    "uuid",
  "group_name"  "text",
  "group_emoji" "text",
  "seat_name"   "text",
  "status"      "text"
)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    g.id,
    g.name,
    g.emoji,
    gm.name,
    CASE WHEN gm.user_id IS NULL THEN 'valid' ELSE 'already_claimed' END
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.seat_token = token
$$;

ALTER FUNCTION "public"."get_seat_by_claim_token"("text") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_seat_by_claim_token"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_seat_by_claim_token"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_seat_by_claim_token"("text") TO "service_role";

-- Path A (self-serve claim): an authenticated user flips a NULL-user_id,
-- active seat to themselves.
--
-- This is NOT a client-side RLS UPDATE, unlike the invite-accept UPDATE in
-- invite/[token]/page.tsx. That precedent works because the invitee already
-- has a group_members row (status='pending') before they act, so the
-- existing "own row" SELECT policy lets them see it. A guest claimer has no
-- row of their own — the seat's user_id is NULL, so no SELECT policy
-- (members-only, own-row) grants them visibility into it, and Postgres RLS
-- requires read access to a row before an UPDATE can match it regardless of
-- the UPDATE policy's USING clause. A same-shape "self can claim" USING/WITH
-- CHECK policy was tried here first and verified against local Postgres to
-- silently match zero rows for a genuine claimer — not a security hole, but
-- a dead flow indistinguishable from success (no error, .maybeSingle()
-- returns null, page shows "already claimed"). SECURITY DEFINER is
-- required, not just convenient, to authorize this write at all.
CREATE OR REPLACE FUNCTION "public"."claim_seat"("token" "text")
RETURNS TABLE("id" "uuid", "group_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claimer uuid := auth.uid();
BEGIN
  IF claimer IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.group_members gm
     SET user_id = claimer,
         name    = COALESCE(
                     (SELECT COALESCE(p.display_name, p.name) FROM public.profiles p WHERE p.id = claimer),
                     gm.name
                   )
   WHERE gm.seat_token = claim_seat.token
     AND gm.user_id IS NULL
     AND gm.status  = 'active'
  RETURNING gm.id, gm.group_id;
END;
$$;

ALTER FUNCTION "public"."claim_seat"("text") OWNER TO "postgres";

-- Grant to authenticated only (not anon) — claiming requires a session,
-- unlike the preview RPC above which must work pre-login.
GRANT ALL ON FUNCTION "public"."claim_seat"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_seat"("text") TO "service_role";

-- Path B (assisted claim) notification: an active member searches for a
-- known Tally user and attaches them to a guest seat via
-- /api/groups/members/claim-invite, which UPDATEs the seat to
-- status='pending' with the target's user_id (preserving group_members.id
-- for expense/settlement continuity, unlike a fresh INSERT). That target
-- must accept/decline like any other invite, per CLAUDE.md's
-- confirmation-required-for-search-adds rule.
--
-- Reuses notify_group_invite() unchanged — its body already checks
-- NEW.status = 'pending' AND NEW.user_id IS NOT NULL, which is exactly
-- this case. The WHEN guard is scoped narrowly enough it can't overlap
-- with Path A (status stays 'active' there) or the decline-to-guest
-- conversion in /api/invite/decline (OLD.user_id IS NOT NULL there).
CREATE OR REPLACE TRIGGER "on_group_member_seat_invited"
  AFTER UPDATE ON "public"."group_members"
  FOR EACH ROW
  WHEN ((OLD.user_id IS NULL) AND (NEW.user_id IS NOT NULL) AND (NEW.status = 'pending'::"text"))
  EXECUTE FUNCTION "public"."notify_group_invite"();
