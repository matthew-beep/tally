-- RPC: create_group_with_members
-- Creates a group, adds the creator, adds existing Tally users as pending,
-- and creates + adds guest profiles as active — all in one atomic transaction.
-- SECURITY DEFINER lets the function insert guest profiles (user_id = NULL)
-- without needing an RLS policy change on profiles.

CREATE OR REPLACE FUNCTION create_group_with_members(
  group_name  text,
  group_emoji text,
  member_ids  uuid[],   -- existing Tally user profile IDs
  guest_names text[]    -- names to create as guest profiles
) RETURNS uuid AS $$
DECLARE
  new_group_id uuid;
  guest_id     uuid;
  mid          uuid;
  gname        text;
BEGIN
  -- Create the group (profiles.id = auth.uid() in this schema)
  INSERT INTO groups (name, emoji, created_by)
  VALUES (group_name, group_emoji, auth.uid())
  RETURNING id INTO new_group_id;

  -- Add creator as active immediately
  INSERT INTO group_members (group_id, user_id, status)
  VALUES (new_group_id, auth.uid(), 'active');

  -- Add existing Tally users as pending — triggers fire group_invite notifications
  FOREACH mid IN ARRAY COALESCE(member_ids, '{}') LOOP
    INSERT INTO group_members (group_id, user_id, status, invited_by)
    VALUES (new_group_id, mid, 'pending', auth.uid());
  END LOOP;

  -- Create guest profiles and add as active
  -- status = 'active' so the invite trigger does not fire (guests have no account)
  FOREACH gname IN ARRAY COALESCE(guest_names, '{}') LOOP
    INSERT INTO profiles (name, status)
    VALUES (gname, 'guest')
    RETURNING id INTO guest_id;

    INSERT INTO group_members (group_id, user_id, status, invited_by)
    VALUES (new_group_id, guest_id, 'active', auth.uid());
  END LOOP;

  RETURN new_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
