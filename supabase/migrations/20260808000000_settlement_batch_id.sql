-- Payment batching: one payment, N group-scoped settlement allocations.
--
-- A single transfer ("I Venmo'd Alex $45") zeroes several groups at once, so
-- it writes N settlement rows. Those rows are the *allocation* of one payment,
-- not N payments -- and the payee should be asked to confirm the payment once,
-- not once per group. batch_id is that payment's identity, carried as a stamp
-- rather than a table (see TODO.md item 5 (c)).
--
-- Universal, not nullable-when-standalone: every settlement gets a batch_id,
-- so a lone settlement is a batch of one and the single case is the degenerate
-- version rather than a branch everywhere downstream. Two consequences of the
-- DEFAULT: useCreateSettlement (singular) needs no change -- Postgres fills
-- it -- and existing rows backfill for free, each becoming its own batch,
-- which is what they were.
--
-- notifications gets its own batch_id rather than reading it through
-- settlement_id. That join does not work for the case batching most needs to
-- fix: settlement_denied deliberately carries settlement_id = NULL (since
-- 20260805010000 -- the row is deleted by the time the AFTER DELETE trigger
-- fires, and the FK would reject a reference to it), so a denied batch would
-- be exactly as ungroupable as it is today. A stamped column groups all four
-- notification types uniformly, whether or not the settlement still exists,
-- and lets the unread count be a distinct-batch count without an embed.
--
-- Triggers stay FOR EACH ROW -- grouping is client-side by batch_id, per the
-- fork decided in TODO.md item 5 (e). A statement-level trigger was rejected
-- there: one notification spanning N settlements can use neither
-- notifications.settlement_id nor an FK to settlements.batch_id (not unique --
-- N rows share it), which breaks PostgREST embedding in useNotifications.

ALTER TABLE "public"."settlements"
  ADD COLUMN "batch_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL;

-- Nullable: group_invite* notifications have no payment behind them.
ALTER TABLE "public"."notifications"
  ADD COLUMN "batch_id" "uuid";

-- Backfill existing unread notifications so they group correctly rather than
-- rendering as loose rows alongside newly-stamped ones. Only the types that
-- still hold a settlement_id can be recovered; settlement_denied rows never
-- had one, and their settlements are gone, so they stay NULL and keep the
-- one-card-per-row behaviour they have today.
UPDATE "public"."notifications" n
   SET "batch_id" = s."batch_id"
  FROM "public"."settlements" s
 WHERE n."settlement_id" = s."id";

-- Grouping reads notifications.batch_id; the batch card then lists its
-- allocations from the settlements sharing that batch.
CREATE INDEX IF NOT EXISTS "settlements_batch_id_idx"
  ON "public"."settlements" USING "btree" ("batch_id");

CREATE INDEX IF NOT EXISTS "notifications_batch_id_idx"
  ON "public"."notifications" USING "btree" ("batch_id");

-- Trigger functions: unchanged except for stamping batch_id onto the
-- notification. Bodies otherwise identical to 20260805010000.

CREATE OR REPLACE FUNCTION "public"."notify_settlement_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  recipient_profile_id uuid;
BEGIN
  IF NEW.status = 'pending' THEN
    -- Debtor recorded it → ask the payee to confirm.
    SELECT user_id INTO recipient_profile_id
      FROM group_members WHERE id = NEW.to_member_id;
    IF recipient_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id, amount, batch_id)
      VALUES ('settlement_confirm', recipient_profile_id, NEW.id, NEW.amount, NEW.batch_id);
    END IF;
  ELSE
    -- Creditor recorded it → tell the payer, no action required.
    SELECT user_id INTO recipient_profile_id
      FROM group_members WHERE id = NEW.from_member_id;
    IF recipient_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id, amount, batch_id)
      VALUES ('settlement_recorded', recipient_profile_id, NEW.id, NEW.amount, NEW.batch_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_settlement_confirmed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  payer_profile_id uuid;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    SELECT user_id INTO payer_profile_id FROM group_members WHERE id = NEW.from_member_id;
    IF payer_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id, amount, batch_id)
      VALUES ('settlement_confirmed', payer_profile_id, NEW.id, NEW.amount, NEW.batch_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_settlement_denied"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  payer_profile_id uuid;
BEGIN
  IF OLD.status = 'pending' THEN
    SELECT user_id INTO payer_profile_id FROM group_members WHERE id = OLD.from_member_id;
    IF payer_profile_id IS NOT NULL THEN
      -- No settlement_id: the row is gone by the time this fires, and the FK
      -- would reject a reference to it. amount and batch_id are captured from
      -- OLD before the DELETE takes effect -- batch_id is the only thing that
      -- can group a multi-row denial, since the settlements it denied no
      -- longer exist to join through.
      INSERT INTO notifications (type, recipient_id, amount, batch_id)
      VALUES ('settlement_denied', payer_profile_id, OLD.amount, OLD.batch_id);
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
