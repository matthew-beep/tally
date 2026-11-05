-- Shared group budgets: a monthly total, category limits, or both.
--
-- Each row applies from starts_month until a later row replaces it, so editing
-- a budget never changes how earlier months read. A row with no total and no
-- limits means "no budget from this month on", which is how removal works.
-- Nothing here feeds a balance: budgets are compared against expenses in the
-- client, and settlements play no part.

CREATE TABLE IF NOT EXISTS "public"."group_budgets" (
  "group_id"     "uuid" NOT NULL REFERENCES "public"."groups"("id") ON DELETE CASCADE,
  "starts_month" "date" NOT NULL,
  "monthly_cap"  numeric(10,2),
  -- SET NULL, not CASCADE: profiles outlive their auth accounts, and a budget
  -- belongs to the group rather than to whoever last saved it.
  "created_by"   "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT "now"(),
  PRIMARY KEY ("group_id", "starts_month"),
  CONSTRAINT "group_budgets_starts_first_of_month" CHECK (EXTRACT(DAY FROM "starts_month") = 1),
  CONSTRAINT "group_budgets_cap_positive" CHECK ("monthly_cap" > 0)
);

CREATE TABLE IF NOT EXISTS "public"."group_budget_limits" (
  "group_id"     "uuid" NOT NULL,
  "starts_month" "date" NOT NULL,
  -- The category emoji, same as expenses.category.
  "category"     "text" NOT NULL,
  "amount"       numeric(10,2) NOT NULL CHECK ("amount" > 0),
  PRIMARY KEY ("group_id", "starts_month", "category"),
  FOREIGN KEY ("group_id", "starts_month")
    REFERENCES "public"."group_budgets"("group_id", "starts_month") ON DELETE CASCADE
);

ALTER TABLE "public"."group_budgets" OWNER TO "postgres";
ALTER TABLE "public"."group_budget_limits" OWNER TO "postgres";

-- Active members only: get_my_group_ids() excludes pending and left seats, so
-- someone previewing an invite can't read a budget. Any active member can edit,
-- matching expenses and group names.
ALTER TABLE "public"."group_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."group_budget_limits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_budgets: active members can read" ON "public"."group_budgets"
  FOR SELECT USING ("group_id" IN (SELECT "public"."get_my_group_ids"()));
CREATE POLICY "group_budgets: active members can insert" ON "public"."group_budgets"
  FOR INSERT WITH CHECK ("group_id" IN (SELECT "public"."get_my_group_ids"()));
CREATE POLICY "group_budgets: active members can update" ON "public"."group_budgets"
  FOR UPDATE USING ("group_id" IN (SELECT "public"."get_my_group_ids"()))
  WITH CHECK ("group_id" IN (SELECT "public"."get_my_group_ids"()));

CREATE POLICY "group_budget_limits: active members can read" ON "public"."group_budget_limits"
  FOR SELECT USING ("group_id" IN (SELECT "public"."get_my_group_ids"()));
CREATE POLICY "group_budget_limits: active members can insert" ON "public"."group_budget_limits"
  FOR INSERT WITH CHECK ("group_id" IN (SELECT "public"."get_my_group_ids"()));
CREATE POLICY "group_budget_limits: active members can delete" ON "public"."group_budget_limits"
  FOR DELETE USING ("group_id" IN (SELECT "public"."get_my_group_ids"()));

REVOKE ALL ON TABLE "public"."group_budgets" FROM "anon";
REVOKE ALL ON TABLE "public"."group_budget_limits" FROM "anon";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."group_budgets" TO "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."group_budget_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."group_budgets" TO "service_role";
GRANT ALL ON TABLE "public"."group_budget_limits" TO "service_role";

-- The total and its limits in one transaction, so a failed save can't leave
-- half a budget. Updates this month's row if there is one, otherwise adds one.
--
-- SECURITY INVOKER: the caller's RLS still decides who may write. Past months
-- are rejected so a budget can't be rewritten after the fact; the day of grace
-- covers a browser still on the last day of the previous month in its timezone.
CREATE OR REPLACE FUNCTION "public"."save_group_budget"(
  "p_group_id"     "uuid",
  "p_starts_month" "date",
  "p_monthly_cap"  numeric,
  "p_limits"       "jsonb"
)
RETURNS void
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_starts_month < date_trunc('month', now() - interval '1 day')::date THEN
    RAISE EXCEPTION 'A past month''s budget can''t be changed';
  END IF;

  INSERT INTO public.group_budgets (group_id, starts_month, monthly_cap, created_by)
  VALUES (p_group_id, p_starts_month, p_monthly_cap, auth.uid())
  ON CONFLICT (group_id, starts_month)
  DO UPDATE SET monthly_cap = EXCLUDED.monthly_cap, created_by = EXCLUDED.created_by;

  DELETE FROM public.group_budget_limits
   WHERE group_id = p_group_id AND starts_month = p_starts_month;

  INSERT INTO public.group_budget_limits (group_id, starts_month, category, amount)
  SELECT p_group_id, p_starts_month, l.key, l.value::numeric
    FROM jsonb_each_text(COALESCE(p_limits, '{}'::jsonb)) l;
END;
$$;

ALTER FUNCTION "public"."save_group_budget"("uuid", "date", numeric, "jsonb") OWNER TO "postgres";

-- No anon grant: saving always requires a signed-in group member.
REVOKE ALL ON FUNCTION "public"."save_group_budget"("uuid", "date", numeric, "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_group_budget"("uuid", "date", numeric, "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_group_budget"("uuid", "date", numeric, "jsonb") TO "service_role";
