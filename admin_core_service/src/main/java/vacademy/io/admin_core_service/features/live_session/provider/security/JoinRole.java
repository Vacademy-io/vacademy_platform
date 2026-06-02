package vacademy.io.admin_core_service.features.live_session.provider.security;

/**
 * Provider-neutral join role resolved server-side by {@link LiveSessionJoinAuthorizer}.
 * Each provider maps it to its own role encoding so no controller ever trusts a
 * client-supplied role value.
 */
public enum JoinRole {
    HOST,
    PARTICIPANT;

    public boolean isHost() {
        return this == HOST;
    }

    /** Zoom Meeting SDK role: 1 = host (gets ZAK), 0 = participant. */
    public int toZoomRole() {
        return this == HOST ? 1 : 0;
    }

    /** BBB role string used by the existing join flow. */
    public String toBbbRole() {
        return this == HOST ? "MODERATOR" : "VIEWER";
    }
}
