-- Comments on expenses. Phase D of docs/social-and-leaderboard-design.md.
--
-- Same shape as expense_reactions (20260809000000): seat-keyed via
-- group_member_id (not profiles.id) so a member who leaves keeps their
-- comments attributed, and group_id denormalized + composite-FK-pinned so RLS
-- stays the same one-subquery shape as every other table instead of reaching
-- a group through expenses. See that migration's header for the full
-- reasoning; it is not repeated here.
--
-- Unlike a reaction, a comment is content worth keeping even after its author
-- takes it back, so removal is soft (deleted_at) rather than DELETE. Readers
-- filter deleted_at IS NULL at the query layer, same as expenses.

CREATE TABLE IF NOT EXISTS "public"."expense_comments" (
  "id"              "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "expense_id"      "uuid" NOT NULL,
  "group_id"        "uuid" NOT NULL,
  "group_member_id" "uuid" NOT NULL,
  "body"            "text" NOT NULL,
  "created_at"      timestamp with time zone DEFAULT "now"() NOT NULL,
  "deleted_at"      timestamp with time zone,
  CONSTRAINT "expense_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_comments_body_len" CHECK (("char_length"("body") BETWEEN 1 AND 1000))
);

ALTER TABLE "public"."expense_comments" OWNER TO "postgres";

-- Reuses the unique (id, group_id) pair added on expenses by the reactions
-- migration — the pair is what makes group_id unforgeable here too.
ALTER TABLE "public"."expense_comments"
  ADD CONSTRAINT "expense_comments_expense_group_fkey"
  FOREIGN KEY ("expense_id", "group_id")
  REFERENCES "public"."expenses" ("id", "group_id")
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."expense_comments"
  ADD CONSTRAINT "expense_comments_group_member_id_fkey"
  FOREIGN KEY ("group_member_id")
  REFERENCES "public"."group_members" ("id") ON DELETE CASCADE;

-- Serves the group-scoped comment-count fetch (['expense-social', groupId]).
CREATE INDEX IF NOT EXISTS "expense_comments_group_id_idx"
  ON "public"."expense_comments" USING "btree" ("group_id");

-- Serves the per-expense thread fetch (['expense-comments', expenseId]),
-- ordered oldest first.
CREATE INDEX IF NOT EXISTS "expense_comments_expense_id_idx"
  ON "public"."expense_comments" USING "btree" ("expense_id", "created_at");

ALTER TABLE "public"."expense_comments" ENABLE ROW LEVEL SECURITY;

-- Read: standard group gate. Soft-deleted rows are still readable here —
-- filtering deleted_at IS NULL is the query layer's job, same as expenses —
-- so a client that wants "was something here" (e.g. a future "comment
-- deleted" placeholder) isn't blocked by RLS from ever seeing that.
CREATE POLICY "expense_comments: group members only"
  ON "public"."expense_comments" FOR SELECT
  USING (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));

-- Write: group gate plus the author check — without it any member could
-- insert a row bearing another member's seat and post as them. Guests can't
-- post: a guest seat has user_id IS NULL, so the check fails same as it does
-- for reactions.
CREATE POLICY "expense_comments: write as yourself only"
  ON "public"."expense_comments" FOR INSERT
  WITH CHECK ((("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids"))
    AND (EXISTS ( SELECT 1
       FROM "public"."group_members" "gm"
      WHERE (("gm"."id" = "expense_comments"."group_member_id")
        AND ("gm"."user_id" = "auth"."uid"())
        AND ("gm"."status" = 'active'::"text"))))));

-- Update: author-only, deliberately without the group gate or status check —
-- same reasoning as the reactions delete policy: someone who has left the
-- group can still take back their own comment. The app only ever writes
-- deleted_at through this path (a soft-delete "take back", not an edit).
CREATE POLICY "expense_comments: soft-delete your own"
  ON "public"."expense_comments" FOR UPDATE
  USING ((EXISTS ( SELECT 1
     FROM "public"."group_members" "gm"
    WHERE (("gm"."id" = "expense_comments"."group_member_id")
      AND ("gm"."user_id" = "auth"."uid"())))))
  WITH CHECK ((EXISTS ( SELECT 1
     FROM "public"."group_members" "gm"
    WHERE (("gm"."id" = "expense_comments"."group_member_id")
      AND ("gm"."user_id" = "auth"."uid"())))));

-- No DELETE policy: removal is the UPDATE above, not a hard delete.

GRANT ALL ON TABLE "public"."expense_comments" TO "anon";
GRANT ALL ON TABLE "public"."expense_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_comments" TO "service_role";
