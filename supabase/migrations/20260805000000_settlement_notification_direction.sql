-- Settlement creation notifications become direction-aware.
--
-- Before this, notify_settlement_created() resolved to_member_id's profile and
-- fired 'settlement_confirm' at it unconditionally. That is only correct for a
-- debtor-recorded settlement ("I paid you"). For a creditor-recorded one
-- ("you paid me") the payee IS the person who wrote the row, so they were sent
-- a request to confirm their own claim, and the payer — whose balance had just
-- moved — was told nothing at all.
--
-- The fix branches on NEW.status. Status carries the direction of the claim:
--
--   pending    debtor recorded it. Self-serving (it discharges their own debt),
--              so the payee is asked to assent → 'settlement_confirm'.
--   confirmed  creditor recorded it. It costs the recorder, not the recipient,
--              so there is nobody to protect — but the payer's balance moved,
--              so they get an informational 'settlement_recorded'.
--
-- No 'recorded_by' column is needed: status already encodes who recorded it,
-- and (per the batch model) is uniform across every row of one payment.
--
-- 'settlement_recorded' is a new notification type rather than a reuse of
-- 'settlement_confirmed'. The two read differently on /me — "Alex confirmed
-- your payment ✓" is a reply to something you did; "Alex marked you as
-- settled" is something Alex did — and collapsing them would force the info
-- card to re-derive which event it was from the settlement row.
--
-- Guest seats have no profile (group_members.user_id IS NULL), so no
-- notification fires for them in either branch — unchanged from before.

ALTER TABLE "public"."notifications"
  DROP CONSTRAINT "notifications_type_check";

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_type_check"
  CHECK (("type" = ANY (ARRAY[
    'group_invite'::"text",
    'group_invite_accepted'::"text",
    'group_invite_declined'::"text",
    'settlement_confirm'::"text",
    'settlement_confirmed'::"text",
    'settlement_recorded'::"text",
    'settlement_denied'::"text"
  ])));

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
      INSERT INTO notifications (type, recipient_id, settlement_id)
      VALUES ('settlement_confirm', recipient_profile_id, NEW.id);
    END IF;
  ELSE
    -- Creditor recorded it → tell the payer, no action required.
    SELECT user_id INTO recipient_profile_id
      FROM group_members WHERE id = NEW.from_member_id;
    IF recipient_profile_id IS NOT NULL THEN
      INSERT INTO notifications (type, recipient_id, settlement_id)
      VALUES ('settlement_recorded', recipient_profile_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
