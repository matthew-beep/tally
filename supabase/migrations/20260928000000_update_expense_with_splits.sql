-- Full expense edit in one transaction: the expense row, then its splits
-- replaced wholesale. Done client-side this was three round trips, and a
-- failure between the delete and the insert left an expense with no splits —
-- money that silently vanished from every balance.
--
-- SECURITY INVOKER: the caller's RLS still decides who may edit ("expenses:
-- group members can update", "expense_splits: group members can delete /
-- insert"). The existing expense_before_update trigger writes the
-- expense_history snapshot as it does for any other UPDATE.
CREATE OR REPLACE FUNCTION "public"."update_expense_with_splits"(
  "p_expense_id"   "uuid",
  "p_description"  "text",
  "p_amount"       numeric,
  "p_paid_by"      "uuid",
  "p_split_type"   "text",
  "p_category"     "text",
  "p_expense_date" "date",
  "p_splits"       "jsonb"
)
RETURNS void
    LANGUAGE "plpgsql" SECURITY INVOKER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  split_total numeric;
BEGIN
  -- Split sum invariant: lib/splits.ts balances before calling, this is the
  -- backstop so an unbalanced edit can never land.
  SELECT COALESCE(SUM((s->>'owed_amount')::numeric), 0)
    INTO split_total
    FROM jsonb_array_elements(p_splits) s;
  IF jsonb_array_length(p_splits) = 0 OR split_total <> p_amount THEN
    RAISE EXCEPTION 'Splits (%) do not sum to the expense amount (%)', split_total, p_amount;
  END IF;

  UPDATE public.expenses
     SET description  = p_description,
         amount       = p_amount,
         paid_by      = p_paid_by,
         split_type   = p_split_type,
         category     = p_category,
         expense_date = p_expense_date
   WHERE id = p_expense_id
     AND deleted_at IS NULL;
  -- RLS filters rather than errors, so a caller outside the group would
  -- otherwise "succeed" at updating nothing.
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found or not editable';
  END IF;

  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

  INSERT INTO public.expense_splits (expense_id, group_member_id, owed_amount)
  SELECT p_expense_id,
         (s->>'group_member_id')::uuid,
         (s->>'owed_amount')::numeric
    FROM jsonb_array_elements(p_splits) s;
END;
$$;

ALTER FUNCTION "public"."update_expense_with_splits"("uuid", "text", numeric, "uuid", "text", "text", "date", "jsonb") OWNER TO "postgres";

-- No anon grant: editing always requires a signed-in group member.
REVOKE ALL ON FUNCTION "public"."update_expense_with_splits"("uuid", "text", numeric, "uuid", "text", "text", "date", "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_expense_with_splits"("uuid", "text", numeric, "uuid", "text", "text", "date", "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_expense_with_splits"("uuid", "text", numeric, "uuid", "text", "text", "date", "jsonb") TO "service_role";
