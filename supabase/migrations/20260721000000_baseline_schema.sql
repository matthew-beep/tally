-- Baseline schema snapshot — replaces all prior migrations.
--
-- The original schema was created by hand in the Supabase dashboard, so no
-- migration ever existed to CREATE the base tables; every tracked migration
-- through 20260719120000 was an incremental ALTER assuming that untracked
-- baseline already existed. That made local dev (`supabase start`/`db reset`)
-- and `supabase db pull`'s diff mechanism both fail: replaying the
-- migrations into an empty shadow database errors on the very first
-- statement (`relation "profiles" does not exist`).
--
-- This file is a full `supabase db dump --linked --schema public` taken
-- 2026-07-21, after 20260719120000 was confirmed live — i.e. it captures
-- the complete, current, real schema in one replayable file. It replaces
-- the 9 fragmented migrations (20260526000000 through 20260719120000),
-- which are preserved in git history if ever needed but no longer apply
-- cleanly on their own. From this point forward, migrations are additive
-- ALTERs on top of this baseline, same as any normal Supabase project.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."get_my_group_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT group_id FROM public.group_members
  WHERE user_id = auth.uid() AND status = 'active'
$$;


ALTER FUNCTION "public"."get_my_group_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    INSERT INTO public.profiles (id, name, email, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
      NEW.email,
      NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_expense_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO expense_history (expense_id, edited_by, snapshot)
  VALUES (OLD.id, auth.uid(), to_jsonb(OLD));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_expense_edit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_group_invite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite', NEW.user_id, NEW.group_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_group_invite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_group_invite_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'active'
     AND NEW.user_id IS NOT NULL
     AND OLD.invited_by IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite_accepted', OLD.invited_by, OLD.group_id);
  ELSIF OLD.status = 'pending'
     AND OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
     AND OLD.invited_by IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite_declined', OLD.invited_by, OLD.group_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_group_invite_accepted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_group_invite_declined"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.status = 'pending' AND OLD.user_id IS NOT NULL AND OLD.invited_by IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, group_id)
    VALUES ('group_invite_declined', OLD.invited_by, OLD.group_id);
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."notify_group_invite_declined"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_settlement_confirmed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  payer_profile_id uuid;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    SELECT user_id INTO payer_profile_id FROM group_members WHERE id = NEW.from_member_id;
    IF payer_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id)
      VALUES ('settlement_confirmed', payer_profile_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_settlement_confirmed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_settlement_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  payee_profile_id uuid;
BEGIN
  SELECT user_id INTO payee_profile_id FROM group_members WHERE id = NEW.to_member_id;
  IF payee_profile_id IS NOT NULL THEN
    INSERT INTO notifications (type, recipient_id, settlement_id)
    VALUES ('settlement_confirm', payee_profile_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_settlement_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_settlement_denied"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  payer_profile_id uuid;
BEGIN
  IF OLD.status = 'pending' THEN
    SELECT user_id INTO payer_profile_id FROM group_members WHERE id = OLD.from_member_id;
    IF payer_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id)
      VALUES ('settlement_denied', payer_profile_id, OLD.id);
    END IF;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."notify_settlement_denied"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."expense_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "edited_by" "uuid" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "edited_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expense_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_item_assignments" (
    "item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."expense_item_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    CONSTRAINT "expense_items_price_check" CHECK (("price" > (0)::numeric))
);


ALTER TABLE "public"."expense_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_splits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "owed_amount" numeric(10,2) NOT NULL,
    "group_member_id" "uuid" NOT NULL
);


ALTER TABLE "public"."expense_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "split_type" "text" DEFAULT 'equal'::"text" NOT NULL,
    "category" "text",
    "tax" numeric(10,2) DEFAULT 0,
    "tip" numeric(10,2) DEFAULT 0,
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "share_token" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "paid_by" "uuid" NOT NULL,
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expenses_split_type_check" CHECK (("split_type" = ANY (ARRAY['equal'::"text", 'exact'::"text", 'percentage'::"text", 'itemized'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    CONSTRAINT "group_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'left'::"text"])))
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" DEFAULT '💸'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "invite_token" "text" DEFAULT "substr"("md5"(("random"())::"text"), 1, 12),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "settlement_id" "uuid",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['group_invite'::"text", 'settlement_confirm'::"text", 'settlement_confirmed'::"text", 'settlement_denied'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text",
    "email" "text",
    "avatar_url" "text",
    "add_code" "text" DEFAULT "upper"("substr"("md5"(("random"())::"text"), 1, 8)),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "claim_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "handle" "text",
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'guest'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "note" "text",
    "settled_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "from_member_id" "uuid" NOT NULL,
    "to_member_id" "uuid" NOT NULL,
    CONSTRAINT "settlements_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "settlements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text"])))
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


ALTER TABLE ONLY "public"."expense_history"
    ADD CONSTRAINT "expense_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_item_assignments"
    ADD CONSTRAINT "expense_item_assignments_pkey" PRIMARY KEY ("item_id", "user_id");



ALTER TABLE ONLY "public"."expense_items"
    ADD CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_expense_member_unique" UNIQUE ("expense_id", "group_member_id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_add_code_key" UNIQUE ("add_code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_claim_token_key" UNIQUE ("claim_token");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "group_members_group_user_unique" ON "public"."group_members" USING "btree" ("group_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_expense_splits_exp" ON "public"."expense_splits" USING "btree" ("expense_id");



CREATE INDEX "idx_expenses_group" ON "public"."expenses" USING "btree" ("group_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_expenses_share_token" ON "public"."expenses" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_group_members_group" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_status" ON "public"."group_members" USING "btree" ("group_id", "status");



CREATE INDEX "idx_group_members_user" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_recip" ON "public"."notifications" USING "btree" ("recipient_id") WHERE ("read" = false);



CREATE INDEX "idx_profiles_add_code" ON "public"."profiles" USING "btree" ("add_code");



CREATE INDEX "idx_profiles_handle" ON "public"."profiles" USING "btree" ("lower"("handle"));



CREATE INDEX "idx_settlements_group" ON "public"."settlements" USING "btree" ("group_id");



CREATE OR REPLACE TRIGGER "expense_before_update" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."log_expense_edit"();



CREATE OR REPLACE TRIGGER "expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "on_group_member_inserted" AFTER INSERT ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_group_invite"();



CREATE OR REPLACE TRIGGER "on_settlement_deleted" AFTER DELETE ON "public"."settlements" FOR EACH ROW EXECUTE FUNCTION "public"."notify_settlement_denied"();



CREATE OR REPLACE TRIGGER "on_settlement_inserted" AFTER INSERT ON "public"."settlements" FOR EACH ROW EXECUTE FUNCTION "public"."notify_settlement_created"();



CREATE OR REPLACE TRIGGER "on_settlement_updated" AFTER UPDATE ON "public"."settlements" FOR EACH ROW EXECUTE FUNCTION "public"."notify_settlement_confirmed"();



ALTER TABLE ONLY "public"."expense_history"
    ADD CONSTRAINT "expense_history_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."expense_history"
    ADD CONSTRAINT "expense_history_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_item_assignments"
    ADD CONSTRAINT "expense_item_assignments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."expense_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_item_assignments"
    ADD CONSTRAINT "expense_item_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_items"
    ADD CONSTRAINT "expense_items_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_group_member_id_fkey" FOREIGN KEY ("group_member_id") REFERENCES "public"."group_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_paid_by_member_id_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."group_members"("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "public"."group_members"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "public"."group_members"("id");



CREATE POLICY "creator can delete" ON "public"."groups" FOR DELETE USING (("created_by" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."expense_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_item_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_item_assignments: group members can insert" ON "public"."expense_item_assignments" FOR INSERT WITH CHECK (("item_id" IN ( SELECT "expense_items"."id"
   FROM "public"."expense_items"
  WHERE ("expense_items"."expense_id" IN ( SELECT "expenses"."id"
           FROM "public"."expenses"
          WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))))));



CREATE POLICY "expense_item_assignments: group members only" ON "public"."expense_item_assignments" FOR SELECT USING (("item_id" IN ( SELECT "expense_items"."id"
   FROM "public"."expense_items"
  WHERE ("expense_items"."expense_id" IN ( SELECT "expenses"."id"
           FROM "public"."expenses"
          WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))))));



ALTER TABLE "public"."expense_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_items: group members can insert" ON "public"."expense_items" FOR INSERT WITH CHECK (("expense_id" IN ( SELECT "expenses"."id"
   FROM "public"."expenses"
  WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))));



CREATE POLICY "expense_items: group members only" ON "public"."expense_items" FOR SELECT USING (("expense_id" IN ( SELECT "expenses"."id"
   FROM "public"."expenses"
  WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))));



ALTER TABLE "public"."expense_splits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_splits: group members can delete" ON "public"."expense_splits" FOR DELETE USING (("expense_id" IN ( SELECT "expenses"."id"
   FROM "public"."expenses"
  WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))));



CREATE POLICY "expense_splits: group members can insert" ON "public"."expense_splits" FOR INSERT WITH CHECK (("expense_id" IN ( SELECT "expenses"."id"
   FROM "public"."expenses"
  WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))));



CREATE POLICY "expense_splits: group members only" ON "public"."expense_splits" FOR SELECT USING (("expense_id" IN ( SELECT "expenses"."id"
   FROM "public"."expenses"
  WHERE ("expenses"."group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")))));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses: group members can insert" ON "public"."expenses" FOR INSERT WITH CHECK (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));



CREATE POLICY "expenses: group members can update" ON "public"."expenses" FOR UPDATE USING (("group_id" IN ( SELECT "gm"."group_id"
   FROM "public"."group_members" "gm"
  WHERE (("gm"."user_id" = "auth"."uid"()) AND ("gm"."status" = 'active'::"text")))));



CREATE POLICY "expenses: group members only" ON "public"."expenses" FOR SELECT USING (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));



CREATE POLICY "group members can view expense history" ON "public"."expense_history" FOR SELECT USING (("expense_id" IN ( SELECT "e"."id"
   FROM "public"."expenses" "e"
  WHERE ("e"."group_id" IN ( SELECT "group_members"."group_id"
           FROM "public"."group_members"
          WHERE (("group_members"."user_id" = "auth"."uid"()) AND ("group_members"."status" = 'active'::"text")))))));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_members: members only" ON "public"."group_members" FOR SELECT USING (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));



CREATE POLICY "group_members: own row" ON "public"."group_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "group_members: self can update status" ON "public"."group_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['active'::"text", 'left'::"text"]))));



CREATE POLICY "group_members: self join" ON "public"."group_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups: authenticated can create" ON "public"."groups" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "groups: creator can update" ON "public"."groups" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "groups: members or creator can read" ON "public"."groups" FOR SELECT USING ((("id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "groups: pending invitee can preview" ON "public"."groups" FOR SELECT USING (("id" IN ( SELECT "group_members"."group_id"
   FROM "public"."group_members"
  WHERE (("group_members"."user_id" = "auth"."uid"()) AND ("group_members"."status" = 'pending'::"text")))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications: recipient can update" ON "public"."notifications" FOR UPDATE USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "notifications: recipient only" ON "public"."notifications" FOR SELECT USING (("recipient_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: anyone can read active" ON "public"."profiles" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "profiles: users update own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settlements: group members can insert" ON "public"."settlements" FOR INSERT WITH CHECK (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));



CREATE POLICY "settlements: group members only" ON "public"."settlements" FOR SELECT USING (("group_id" IN ( SELECT "public"."get_my_group_ids"() AS "get_my_group_ids")));



CREATE POLICY "settlements: parties can delete" ON "public"."settlements" FOR DELETE USING ((("from_member_id" IN ( SELECT "group_members"."id"
   FROM "public"."group_members"
  WHERE ("group_members"."user_id" = "auth"."uid"()))) OR ("to_member_id" IN ( SELECT "group_members"."id"
   FROM "public"."group_members"
  WHERE ("group_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "settlements: payee can update" ON "public"."settlements" FOR UPDATE USING (("to_member_id" IN ( SELECT "group_members"."id"
   FROM "public"."group_members"
  WHERE ("group_members"."user_id" = "auth"."uid"()))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_group_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_group_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_group_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_expense_edit"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_expense_edit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_expense_edit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_group_invite"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_group_invite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_group_invite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_group_invite_accepted"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_group_invite_accepted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_group_invite_accepted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_group_invite_declined"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_group_invite_declined"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_group_invite_declined"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_settlement_confirmed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_settlement_confirmed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_settlement_confirmed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_settlement_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_settlement_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_settlement_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_settlement_denied"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_settlement_denied"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_settlement_denied"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."expense_history" TO "anon";
GRANT ALL ON TABLE "public"."expense_history" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_history" TO "service_role";



GRANT ALL ON TABLE "public"."expense_item_assignments" TO "anon";
GRANT ALL ON TABLE "public"."expense_item_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_item_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."expense_items" TO "anon";
GRANT ALL ON TABLE "public"."expense_items" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_items" TO "service_role";



GRANT ALL ON TABLE "public"."expense_splits" TO "anon";
GRANT ALL ON TABLE "public"."expense_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_splits" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."settlements" TO "anon";
GRANT ALL ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







