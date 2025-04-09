package vacademy.io.admin_core_service.features.learner_reports.dto.report_notification;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LmsReportNotificationSettingDTO {

    // Notification settings for student and parent
    private ReportNotificationSetting learnerSetting;
    private ReportNotificationSetting parentSetting;

    @Data
    @Builder
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class ReportNotificationSetting {
        // EMAIL, WHATSAPP (comma-separated)
        private String commaSeparatedCommunicationTypes;

        // Frequency settings for learner (individual) progress reports
        private NotificationFrequency learnerProgressReport;

        // Frequency settings for batch progress reports
        private NotificationFrequency batchProgressReport;

        private String commaSeparatedEmailIds;
        private String commaSeparatedMobileNumber;
    }

    @Data
    @Builder
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class NotificationFrequency {
        private Boolean daily;
        private Boolean weekly;
        private Boolean monthly;
    }
}

