-- group_members_group_user_unique was a partial index (WHERE user_id IS NOT
-- NULL, added so guest rows with user_id = NULL could repeat). Partial
-- indexes can't be targeted by ON CONFLICT (group_id, user_id) inference
-- unless the same WHERE predicate is repeated in the ON CONFLICT clause,
-- which supabase-js's onConflict option can't express. Every upsert of a
-- real member in /api/groups/members/add hit "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification".
--
-- Dropping the WHERE clause fixes this without changing guest behavior:
-- Postgres unique indexes already treat NULLs as distinct from each other,
-- so multiple guest rows (user_id IS NULL) per group remain unrestricted.

DROP INDEX "public"."group_members_group_user_unique";

CREATE UNIQUE INDEX "group_members_group_user_unique"
  ON "public"."group_members" USING "btree" ("group_id", "user_id");
