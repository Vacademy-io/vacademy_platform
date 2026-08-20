package vacademy.io.admin_core_service.features.learner_credentials.enums;

/**
 * Which body an admin-triggered credential / password-reset mail is rendered from.
 *
 * <p>{@link #DEFAULT} keeps the platform's built-in wording (the Java text block in
 * auth_service, plus any institute workflow already wired to the event) — nothing to configure,
 * identical to how these buttons behaved before templates existed.
 *
 * <p>{@link #TEMPLATE} renders the institute's own template instead, so the message carries their
 * branding and wording. Both modes stay available per send: an institute that has authored a
 * template still wants the default available while they are drafting a replacement.
 */
public enum CredentialDeliveryMode {
    DEFAULT,
    TEMPLATE
}
