-- Denormalize settlement amount onto notifications.
--
-- notify_settlement_denied() previously tried to INSERT a notification
-- referencing the settlement it was about (settlement_id = OLD.id) from an
-- AFTER DELETE trigger -- but by the time that trigger fires, the row is
-- already gone, and notifications.settlement_id has a strict FK requiring
-- it to exist. Every deny attempt failed with a foreign key violation
-- (verified live 2026-08-05, rolled-back test transaction); the whole
-- DELETE aborted, so denial has never actually worked.
--
-- Fix: settlement_denied never sets settlement_id (structurally can't --
-- deny's whole point is deleting that row). It stamps OLD.amount onto the
-- notification directly instead, read before the row disappears.
--
-- Applied to all four settlement notification inserts, not just denied, for
-- symmetry -- and because Phase 3's planned "delete a settlement" feature
-- would otherwise cascade-erase settlement_confirmed/settlement_recorded
-- amounts too the moment a confirmed settlement is deleted after the fact.

ALTER TABLE "public"."notifications" ADD COLUMN "amount" numeric(10,2);

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
      INSERT INTO notifications (type, recipient_id, settlement_id, amount)
      VALUES ('settlement_confirm', recipient_profile_id, NEW.id, NEW.amount);
    END IF;
  ELSE
    -- Creditor recorded it → tell the payer, no action required.
    SELECT user_id INTO recipient_profile_id
      FROM group_members WHERE id = NEW.from_member_id;
    IF recipient_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id, amount)
      VALUES ('settlement_recorded', recipient_profile_id, NEW.id, NEW.amount);
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
      INSERT INTO notifications (type, recipient_id, settlement_id, amount)
      VALUES ('settlement_confirmed', payer_profile_id, NEW.id, NEW.amount);
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
      -- would reject a reference to it. amount is captured from OLD before
      -- the DELETE takes effect.
      INSERT INTO notifications (type, recipient_id, amount)
      VALUES ('settlement_denied', payer_profile_id, OLD.amount);
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
