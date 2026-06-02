package vacademy.io.admin_core_service.features.live_session.provider.security;

/**
 * Result of a join-authorization check: the server-resolved {@link JoinRole} and
 * the session's institute id (for downstream logging / scoping). Provider-neutral
 * so any SDK-join or join-URL provider can consume it.
 */
public record JoinAuthorization(JoinRole role, String instituteId) {
}
