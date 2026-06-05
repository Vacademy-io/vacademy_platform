-- =============================================================================
-- Telephony inbound: route a lead callback to the right counsellor, and
-- auto-attach ExoPhones to the institute's App Bazaar flow.
--
-- The outbound flow (V319) handles counsellor → lead. This migration adds the
-- minimum schema needed for lead → counsellor plus the supporting pieces for
-- one-click flow attachment via Exotel's IncomingPhoneNumbers API.
--
--   1. inbound_voicemail_number on institute_telephony_config
--      Final-fallback number we dial when no counsellor in the routing
--      waterfall is reachable. Nullable — when blank, the Connect-applet
--      response drops the call to Exotel's default "no agents available"
--      message and we just log a missed-call event.
--
--   2. flow_sid on institute_telephony_config
--      App Bazaar flow id the admin pastes in once after creating their
--      inbound flow. Once set, every new/updated ExoPhone is auto-attached
--      to this flow via PUT /v2_beta/Accounts/<sid>/IncomingPhoneNumbers
--      so the admin never has to click into the Exotel dashboard to wire
--      up a new number.
--
--   3. counsellor_user_id becomes nullable on telephony_call_log
--      Outbound calls always have a counsellor (the actor who clicked Call).
--      Inbound calls that fall through to voicemail with no agent reached do
--      not. Make the column nullable rather than fake a sentinel UUID.
--
--   4. flow_attach_status + flow_attach_error + flow_attached_at on
--      telephony_provider_number
--      Per-ExoPhone outcome of the most recent auto-attach attempt:
--      ATTACHED | PENDING | FAILED | DETACHED (NULL = never attempted).
--      Shown in the Numbers card as a status pill so admins instantly see
--      whether their inbound routing is wired up.
--
-- Per-counsellor preferences (opt-out, mobile override) intentionally NOT in
-- this migration — when a real customer asks for either, the right answer is
-- a generic per-(user, institute) preferences table reused across telephony,
-- notifications, dashboard prefs, etc. — not a telephony-specific table for
-- two niche columns. Today, the routing layer trusts auth-service's mobile.
--
-- See docs/EXOTEL_CALL_INTEGRATION.md (inbound section) for the full design
-- — particularly the routing waterfall and the latency budget on the
-- Connect-applet URL (sub-200 ms target, Exotel waits synchronously).
-- =============================================================================


-- ── 1. Inbound config on the existing per-institute row ─────────────────────
ALTER TABLE institute_telephony_config
    ADD COLUMN inbound_voicemail_number VARCHAR(32),
    ADD COLUMN flow_sid                 VARCHAR(64);

COMMENT ON COLUMN institute_telephony_config.inbound_voicemail_number IS
    'Optional E.164 number dialled as the last leg of the inbound routing waterfall when no counsellor is available. NULL = no fallback dial (call drops to provider default).';

COMMENT ON COLUMN institute_telephony_config.flow_sid IS
    'App Bazaar flow id the admin pastes in once after creating their inbound flow. When set, every new/updated ExoPhone is auto-attached to this flow via Exotel''s IncomingPhoneNumbers PUT API.';


-- ── 2. Allow counsellor_user_id to be NULL on call_log (inbound-voicemail) ──
ALTER TABLE telephony_call_log
    ALTER COLUMN counsellor_user_id DROP NOT NULL;

COMMENT ON COLUMN telephony_call_log.counsellor_user_id IS
    'Outbound: the actor who placed the call (always set). Inbound: the routing winner at INITIATED time, NULL when the call goes straight to voicemail with no agent reachable.';


-- ── 3. Index for inbound "last counsellor" lookup ───────────────────────────
-- LastCounsellorInboundRouter does a suffix-match on the lead's phone over
-- recent OUTBOUND rows scoped to one institute. The regexp_replace expression
-- prevents a direct index hit on the suffix, but this composite at least
-- narrows the scan to "this institute's outbound rows" before the per-row
-- regex runs — enough to keep the synchronous Connect-applet path inside
-- the 200ms budget on dev-scale data. If we hit problems at scale, the next
-- step is a generated column for the last-10-digits of to_number.
CREATE INDEX idx_tcl_inbound_lookup
    ON telephony_call_log(institute_id, direction, created_at DESC)
    WHERE direction = 'OUTBOUND' AND counsellor_user_id IS NOT NULL;


-- ── 4. Per-ExoPhone auto-attach status ──────────────────────────────────────
-- ATTACHED  - last attach succeeded; the number rings the right flow.
-- PENDING   - attach not yet attempted (flow_sid was empty / number created
--             before the flow was saved). The UI surfaces a "retry" button.
-- FAILED    - attach returned a non-2xx; flow_attach_error holds the Exotel
--             error body so the admin can read what's wrong.
-- DETACHED  - we marked the attachment as removed on number delete/disable.
ALTER TABLE telephony_provider_number
    ADD COLUMN flow_attach_status VARCHAR(16),
    ADD COLUMN flow_attach_error  TEXT,
    ADD COLUMN flow_attached_at   TIMESTAMP;

COMMENT ON COLUMN telephony_provider_number.flow_attach_status IS
    'Result of the most recent Exotel-flow attach attempt: ATTACHED | PENDING | FAILED | DETACHED. NULL = never attempted.';

COMMENT ON COLUMN telephony_provider_number.provider_resource_id IS
    'The Exotel-side ExoPhone Sid (e.g. KX_xxx). Required for inbound flow attach via the IncomingPhoneNumbers API; UI offers a "Sync from Exotel" action to populate it without manual copy-paste.';
