-- Any active member can rename a group or change its emoji — previously
-- creator-only.
--
-- RLS decides which rows a member may update but not which columns, so a
-- member-wide UPDATE policy on its own would also let any member rewrite
-- created_by (taking over admin) or invite_token. Column privileges close
-- that: authenticated can update name and emoji and nothing else. The app's
-- only client-side write to groups is exactly those two (useUpdateGroup);
-- everything else goes through service-role routes or SECURITY DEFINER
-- functions, which column grants don't touch.

DROP POLICY IF EXISTS "groups: creator can update" ON "public"."groups";

CREATE POLICY "groups: active members can update" ON "public"."groups"
  FOR UPDATE
  USING      ("id" IN (SELECT "public"."get_my_group_ids"()))
  WITH CHECK ("id" IN (SELECT "public"."get_my_group_ids"()));

REVOKE UPDATE ON TABLE "public"."groups" FROM "anon", "authenticated";
GRANT UPDATE ("name", "emoji") ON TABLE "public"."groups" TO "authenticated";
