package vacademy.io.assessment_service.features.notification.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.notification.service.AssessmentNotificationService;

@RestController
@RequestMapping("/assessment-service/notification")
@RequiredArgsConstructor
public class AssessmentNotificationController {

    private final AssessmentNotificationService assessmentNotificationService;

    @PostMapping("/upcoming")
    public ResponseEntity<String> sendNotificationForUpcomingAssessments() {
        assessmentNotificationService.sendNotificationsWhenAssessmentsAboutToStart();
        return ResponseEntity.ok("Notifications sent for upcoming assessments.");
    }

    @PostMapping("/started")
    public ResponseEntity<String> sendNotificationForStartedAssessments() {
        assessmentNotificationService.sendNotificationsForStartedAssessments();
        return ResponseEntity.ok("Notifications sent for started assessments.");
    }

}