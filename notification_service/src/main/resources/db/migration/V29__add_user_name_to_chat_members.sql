-- DIRECT conversations carry no stored title; they're shown titled with the OTHER participant's
-- display name. Persist a name snapshot on the member row (set at DM creation) so the title is
-- available without a per-render user lookup. Nullable; group/community members leave it null
-- (those are titled by batch/community name, and messages already carry sender names).
ALTER TABLE chat_conversation_members ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
