package vacademy.io.admin_core_service.features.learner_reports.dto.report_notification;

import lombok.Data;

import java.util.List;

@Data
public class LmsReportNotificationDetailsDTO {
    private String instituteId;
    private String instituteName;
    private InstituteData instituteData;

    @Data
    public static class InstituteData {
        private List<NotificationSetting> notificationSettings;
        private List<PackageSessionData> packageSessions;

        @Data
        public static class NotificationSetting {
            private String id;
            private String source;
            private String sourceId;
            private String type;
            private String status;
            private String commaSeparatedCommunicationTypes;
            private String commaSeparatedEmailIds;
            private String commaSeparatedMobileNumbers;
            private String commaSeparatedRoles;
            private boolean daily;
            private boolean weekly;
            private boolean monthly;
        }

        @Data
        public static class PackageSessionData {
            private String packageSessionId;
            private String batch;
            private List<StudentData> students;

            @Data
            public static class StudentData {
                private String userId;
                private String fullName;
                private String parentEmail;
                private String parentsMobileNumber;
                private List<NotificationSetting> notificationSettings;
            }
        }
    }
}
