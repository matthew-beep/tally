-- Decline-to-guest conversion support.
--
-- Declining an invite after being included in expenses converts the seat to a
-- guest (UPDATE group_members SET user_id = NULL, status = 'active') so splits
-- and balances survive. The UPDATE trigger must:
--   1. NOT fire 'group_invite_accepted' for that conversion (it matches the
--      old pending→active condition), and
--   2. fire 'group_invite_declined' instead — the DELETE trigger only covers
--      the no-history decline path.

CREATE OR REPLACE FUNCTION notify_group_invite_accepted()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
