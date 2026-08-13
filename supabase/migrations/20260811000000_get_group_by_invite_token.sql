-- Cold invite-link lookup: a brand-new invitee has no group_members row yet,
-- so the existing "groups: members or creator can read" / "groups: pending
-- invitee can preview" policies can't authorize the /invite/[token] page's
-- group-by-token lookup. RLS restricts rows, not columns — a table-level
-- policy permissive enough to allow this would let anyone enumerate the
-- whole groups table via a direct REST call with no token filter at all.
-- SECURITY DEFINER bakes the token match into the function body instead,
-- same mechanism as get_my_group_ids(), and whitelists exactly the columns
-- returned (never invite_token itself, never created_by).
CREATE OR REPLACE FUNCTION "public"."get_group_by_invite_token"("token" "text")
RETURNS TABLE("id" "uuid", "name" "text", "emoji" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, name, emoji
  FROM public.groups
  WHERE invite_token = token
$$;

ALTER FUNCTION "public"."get_group_by_invite_token"("text") OWNER TO "postgres";

-- Grant to anon deliberately: security comes entirely from the function
-- body, not session state, so this must work identically for a visitor who
-- hasn't signed in yet.
GRANT ALL ON FUNCTION "public"."get_group_by_invite_token"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_group_by_invite_token"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_group_by_invite_token"("text") TO "service_role";
