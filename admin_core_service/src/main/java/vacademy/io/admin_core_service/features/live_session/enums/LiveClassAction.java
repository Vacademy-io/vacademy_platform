package vacademy.io.admin_core_service.features.live_session.enums;

public enum LiveClassAction {
    CREATED("Created"),
    STARTING("Starting"),
    STARTED("Started");
    
    private final String displayName;
    
    LiveClassAction(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}
