package vacademy.io.notification_service.features.firebase_notifications.dto;
public class FcmNotificationRequest {
    private String userId;
    private String instituteId;
    private String title;
    private String body;

    // Constructors
    public FcmNotificationRequest() {}

    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public String getInstituteId() { return instituteId; }
    public void setInstituteId(String instituteId) { this.instituteId = instituteId; }
}