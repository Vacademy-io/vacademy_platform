-- V14: Per-user preferred locale (i18n Phase 0).
--
-- BCP-47 primary language subtag ("en", "ar", "hi", ...) validated against
-- vacademy.io.common.core.i18n.LocaleRegistry before persisting. NULL means
-- "no explicit preference" — resolution falls back to Accept-Language /
-- institute default / "en", so this is a no-op for existing users.

ALTER TABLE public.users
ADD COLUMN preferred_locale VARCHAR(10) NULL;

COMMENT ON COLUMN public.users.preferred_locale IS 'BCP-47 language tag the user prefers for UI/messages (e.g. en, ar, hi); NULL = no explicit preference';
