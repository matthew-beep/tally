-- Wires the accept/decline notification path for group_members.
--
-- notify_group_invite_accepted() already handles both transitions in one
-- function body: pending -> active (accept) and user_id: <id> -> null with
-- status staying active (decline, which now always converts the seat to a
-- guest rather than deleting the row — see /api/invite/decline and
-- docs/notifications-and-membership-design.md). Neither branch has ever
-- fired because no trigger called this function.
--
-- notify_group_invite_declined() was written for the old DELETE-based
-- decline path. Decline no longer deletes group_members rows, so it's dead
-- code — dropped here.

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
    'settlement_denied'::"text"
  ])));

CREATE OR REPLACE TRIGGER "on_group_member_updated"
  AFTER UPDATE ON "public"."group_members"
  FOR EACH ROW EXECUTE FUNCTION "public"."notify_group_invite_accepted"();

DROP FUNCTION IF EXISTS "public"."notify_group_invite_declined"();
