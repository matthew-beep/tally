-- Emoji reactions on expenses. Phase C of docs/social-and-leaderboard-design.md.
--
-- The first non-financial rows in a group. Nothing here may ever reach a
-- balance: not calcNetBalances, not calcPairwiseNets, not mergeFeed. The table
-- exists beside the ledger, not inside it.
--
-- KEYED BY THE SEAT, NOT THE PERSON. group_member_id -> group_members.id, the
-- same key the money tables use. A reaction is in-group social, so it renders
-- through the exact path the feed already uses (memberById / slotFor /
-- avatarProfile), and a member who leaves keeps their reactions attributed
-- rather than orphaned. Cross-group concerns key by profiles.id; this is not
-- one of those.
--
-- WHY group_id IS DENORMALIZED. Every other RLS policy in this schema gates on
-- `group_id IN (SELECT get_my_group_ids())`. Without a group_id column the
-- policy here would have to reach a group through expenses:
--
--   expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT ...))
--
-- A one-off policy shape is exactly how the two silent critical RLS bugs in
-- docs/schema.md happened. Carrying group_id makes this policy byte-identical
-- to the other six, and makes "every reaction in this group" -- which is what
-- the ['expense-social', groupId] query asks for -- one indexed lookup instead
-- of a subquery per row.
--
-- The cost of denormalizing is drift: a row could claim a group its expense
-- does not belong to, and RLS would then gate on the wrong one -- a
-- write-into-someone-else's-group primitive. A CHECK constraint cannot contain
-- a subquery, and a trigger is code that can be dropped or forgotten. The
-- composite FK below closes it declaratively: the PAIR (expense_id, group_id)
-- must exist in expenses, and since expenses.id is the PK there is exactly one
-- valid pair per expense. Postgres requires a unique constraint on the
-- referenced columns before that FK can be declared, which is the only reason
-- the expenses table is touched at all.
--
-- TOGGLING IS INSERT/DELETE, NOT A COUNTER. The UNIQUE below is the whole
-- mechanism: no count column to drift, no read-modify-write race, and a
-- double-tap fails loudly on the constraint instead of silently
-- double-counting. Counts are derived at render time from the rows.
--
-- The allowed emoji set stays in app code. A SQL whitelist would need a
-- migration every time it changes, and it will change; the DB enforces only
-- that the value is short.

-- Prerequisite for the composite FK below. Logically redundant (id is already
-- the PK, so any superset is unique) but Postgres will not let an FK target
-- these columns without it. Additive: no column changes, no rewrite, no
-- backfill, and nothing existing references it.
ALTER TABLE "public"."expenses"
  ADD CONSTRAINT "expenses_id_group_id_key" UNIQUE ("id", "group_id");

CREATE TABLE IF NOT EXISTS "public"."expense_reactions" (
  "id"              "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "expense_id"      "uuid" NOT NULL,
  "group_id"        "uuid" NOT NULL,
  "group_member_id" "uuid" NOT NULL,
  "emoji"           "text" NOT NULL,
  "created_at"      timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "expense_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_reactions_emoji_len" CHECK (("char_length"("emoji") BETWEEN 1 AND 8)),
  -- One member, one expense, one emoji. Re-reacting is a DELETE.
  CONSTRAINT "expense_reactions_unique" UNIQUE ("expense_id", "group_member_id", "emoji")
);

ALTER TABLE "public"."expense_reactions" OWNER TO "postgres";

-- The pair, not the columns separately: this is what makes group_id unforgeable.
ALTER TABLE "public"."expense_reactions"
  ADD CONSTRAINT "expense_reactions_expense_group_fkey"
  FOREIGN KEY ("expense_id", "group_id")
  REFERENCES "public"."expenses" ("id", "group_id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."expense_reactions"
  ADD CONSTRAINT "expense_reactions_group_member_id_fkey"
  FOREIGN KEY ("group_member_id")
  REFERENCES "public"."group_members" ("id") ON DELETE CASCADE;

-- Note the cascade above almost never fires: expenses are soft-deleted, so
-- reactions outlive a "deleted" expense and simply stop being fetched, exactly
-- as expense_splits do. It fires only on a true hard delete or a group delete.

-- Serves the group-scoped fetch. The UNIQUE constraint already indexes
-- expense_id as its leading column, so per-expense lookups need no index here.
CREATE INDEX IF NOT EXISTS "expense_reactions_group_id_idx"
  ON "public"."expense_reactions" USING "btree" ("group_id");

ALTER TABLE "public"."expense_reactions" ENABLE ROW LEVEL SECURITY;

-- Read: the standard gate, identical to every other table. get_my_group_ids()
-- filters status = 'active', so pending and left members are already excluded.
CREATE POLICY "expense_reactions: group members only"
  ON "public"."expense_reactions" FOR SELECT
  USING (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));

-- Write: the group gate is NOT sufficient on its own. Without the author check
-- any member could insert a row bearing another member's seat and react as
-- them. The status filter is belt-and-braces -- the group gate already excludes
-- non-active seats -- but it keeps this policy true on its own terms rather
-- than dependent on the helper's internals.
--
-- Guests cannot react, and need no special case: a guest seat has
-- user_id IS NULL, so gm.user_id = auth.uid() is NULL rather than true and the
-- check fails. This is also what stops the organiser who created a guest seat
-- from reacting on its behalf.
CREATE POLICY "expense_reactions: write as yourself only"
  ON "public"."expense_reactions" FOR INSERT
  WITH CHECK ((("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids"))
    AND (EXISTS ( SELECT 1
       FROM "public"."group_members" "gm"
      WHERE (("gm"."id" = "expense_reactions"."group_member_id")
        AND ("gm"."user_id" = "auth"."uid"())
        AND ("gm"."status" = 'active'::"text"))))));

-- Delete: author check only, deliberately WITHOUT the group gate. Someone who
-- has left the group can still take back their own reaction. This is the one
-- place status intentionally diverges from every other policy -- it is not an
-- oversight.
CREATE POLICY "expense_reactions: delete your own"
  ON "public"."expense_reactions" FOR DELETE
  USING ((EXISTS ( SELECT 1
     FROM "public"."group_members" "gm"
    WHERE (("gm"."id" = "expense_reactions"."group_member_id")
      AND ("gm"."user_id" = "auth"."uid"())))));

-- No UPDATE policy: a reaction has nothing to change. Changing your mind is a
-- DELETE plus an INSERT.

GRANT ALL ON TABLE "public"."expense_reactions" TO "anon";
GRANT ALL ON TABLE "public"."expense_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_reactions" TO "service_role";
