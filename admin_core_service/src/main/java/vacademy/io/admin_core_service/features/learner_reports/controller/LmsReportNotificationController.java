package vacademy.io.admin_core_service.features.learner_reports.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner_reports.dto.report_notification.LmsReportNotificationDetailsDTO;
import vacademy.io.admin_core_service.features.learner_reports.service.LmsReportNotificationSchedulerService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner-management/notification")
public class LmsReportNotificationController {

    @Autowired
    private LmsReportNotificationSchedulerService lmsReportNotificationSchedulerService;

    @PostMapping("/send-daily-report")
    public ResponseEntity<Boolean> sendDailyReport() {
        return ResponseEntity.ok(lmsReportNotificationSchedulerService.sendDailyReport());
    }

    @PostMapping("/send-weekly-report")
    public ResponseEntity<Boolean>sendWeeklyReport() {
        return ResponseEntity.ok(lmsReportNotificationSchedulerService.sendWeeklyReport());
    }

    @PostMapping("/send-monthly-report")
    public ResponseEntity<Boolean>sendMonthlyReport() {
        return ResponseEntity.ok(lmsReportNotificationSchedulerService.sendWeeklyReport());
    }
}
