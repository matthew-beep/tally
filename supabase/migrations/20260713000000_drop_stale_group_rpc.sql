-- Drop the create_group_with_members RPC (from 20260617000000).
--
-- Dead code: nothing calls .rpc() anywhere — group creation goes through
-- POST /api/groups/create. It is also broken under the member model
-- (inserts group_members without the NOT NULL name column, and creates
-- guest *profiles* per the pre-20260621 design).

DROP FUNCTION IF EXISTS create_group_with_members(text, text, uuid[], text[]);
