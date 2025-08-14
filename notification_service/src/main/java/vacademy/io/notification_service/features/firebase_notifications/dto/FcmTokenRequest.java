package vacademy.io.notification_service.features.firebase_notifications.dto;


public class FcmTokenRequest {
    private String token;
    private String platform;
    private String deviceId;
    private String userId;
    private String instituteId;

    // Constructors
    public FcmTokenRequest() {}

    // Getters and Setters
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getInstituteId() { return instituteId; }
    public void setInstituteId(String instituteId) { this.instituteId = instituteId; }
}