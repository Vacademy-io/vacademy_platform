package vacademy.io.assessment_service.features.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.auth_service.service.AuthService;
import vacademy.io.assessment_service.features.notification.dto.NotificationDTO;
import vacademy.io.assessment_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.assessment_service.features.notification.enums.NotificationSourceEnum;
import vacademy.io.assessment_service.features.notification.enums.NotificationType;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.auth.enums.CompanyStatus;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssessmentNotificationService {

    private final AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;
    private final AssessmentRepository assessmentRepository;
    private final NotificationService notificationService;
    private final AuthService authService;

    @Value("${scheduling.time.frame}")
    private Integer timeFrameInMinutes;

    /**
     * Sends notifications when an assessment is created.
     */
    public void sendAssessmentNotificationWhenCreated(Assessment assessment, String instituteId) {
        List<AssessmentUserRegistration> userRegistrations = getActiveUsersForAssessment(assessment.getId());

        NotificationDTO notificationDTO = buildNotificationDTO(
                "New Assessment Created",
                AssessmentNotificaionEmailBody.EMAIL_BODY_WHEN_ASSESSMENT_CREATED,
                assessment.getId(),
                userRegistrations,
                assessment
        );

        notificationService.sendEmailToUsers(notificationDTO);
    }

    /**
     * Sends notifications for upcoming assessments within the configured time frame.
     */
    public void sendNotificationsWhenAssessmentsAboutToStart() {
        List<Assessment> upcomingAssessments = getUpcomingAssessments();

        for (Assessment assessment : upcomingAssessments) {
            List<AssessmentUserRegistration> userRegistrations = getActiveUsersForAssessment(assessment.getId());

            NotificationDTO notificationDTO = buildNotificationDTO(
                    "Upcoming Assessment Reminder",
                    AssessmentNotificaionEmailBody.EMAIL_BODY_WHEN_ASSESSMENT_ABOUT_TO_START,
                    assessment.getId(),
                    userRegistrations,
                    assessment
            );

            notificationService.sendEmailToUsers(notificationDTO);
        }
    }

    /**
     * Retrieves active users for a given assessment.
     */
    private List<AssessmentUserRegistration> getActiveUsersForAssessment(String assessmentId) {
        return assessmentUserRegistrationRepository.findByInstituteIdAndAssessmentIdAndStatusIn(
                assessmentId,
                List.of(CompanyStatus.ACTIVE.name())
        );
    }

    /**
     * Retrieves upcoming assessments within the configured time frame.
     */
    private List<Assessment> getUpcomingAssessments() {
        return assessmentRepository.findAssessmentsStartingWithinTimeFrame(
                timeFrameInMinutes,
                List.of(AssessmentStatus.PUBLISHED.name())
        );
    }

    /**
     * Builds a notification DTO for assessment notifications.
     */
    private NotificationDTO buildNotificationDTO(String subject, String body, String sourceId,
                                                 List<AssessmentUserRegistration> userRegistrations,
                                                 Assessment assessment) {
        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setSubject(subject);
        notificationDTO.setBody(body);
        notificationDTO.setSource(NotificationSourceEnum.ASSESSMENT.name());
        notificationDTO.setSourceId(sourceId);
        notificationDTO.setNotificationType(NotificationType.EMAIL.name());
        notificationDTO.setUsers(mapToNotificationUsers(userRegistrations, assessment));

        return notificationDTO;
    }

    /**
     * Maps user registrations to notification user DTOs.
     */
    private List<NotificationToUserDTO> mapToNotificationUsers(List<AssessmentUserRegistration> userRegistrations,
                                                               Assessment assessment) {
        return userRegistrations.stream()
                .map(user -> {
                    NotificationToUserDTO dto = new NotificationToUserDTO();
                    dto.setUserId(user.getUserId());
                    dto.setChannelId(user.getUserEmail());

                    Map<String, String> placeholders = new HashMap<>();
                    placeholders.put("learner_name", user.getParticipantName());
                    placeholders.put("assessment_name", assessment.getName());
                    placeholders.put("start_time", assessment.getBoundStartTime().toString());
                    placeholders.put("end_time", assessment.getBoundEndTime().toString());
                    placeholders.put("duration", String.valueOf(assessment.getDuration()));
                    dto.setPlaceholders(placeholders);
                    return dto;
                }).collect(Collectors.toList());
    }

    public void sendNotificationsForStartedAssessments() {
        List<Assessment> assessments = assessmentRepository.findRecentlyStartedAssessments(
                timeFrameInMinutes, List.of(AssessmentStatus.PUBLISHED.name()));

        for (Assessment assessment : assessments) {
            List<AssessmentUserRegistration> registrations = getActiveUsersForAssessment(assessment.getId());

            NotificationDTO notificationDTO = new NotificationDTO();
            notificationDTO.setBody(AssessmentNotificaionEmailBody.EMAIL_BODY_WHEN_ASSESSMENT_STARTED);
            notificationDTO.setSource(NotificationSourceEnum.ASSESSMENT.name());
            notificationDTO.setSubject("Assessment Started Notification");
            notificationDTO.setSourceId(assessment.getId());
            notificationDTO.setNotificationType(NotificationType.EMAIL.name());

            List<NotificationToUserDTO> notificationToUsers = registrations.stream()
                    .map(registration -> {
                        NotificationToUserDTO notificationToUser = new NotificationToUserDTO();
                        notificationToUser.setUserId(registration.getUserId());
                        notificationToUser.setChannelId(registration.getUserEmail());

                        Map<String, String> placeholders = new HashMap<>();
                        placeholders.put("learner_name", registration.getParticipantName());
                        placeholders.put("assessment_name", assessment.getName());
                        placeholders.put("start_time", assessment.getBoundStartTime().toString());
                        placeholders.put("duration", String.valueOf(assessment.getDuration()));
                        placeholders.put("end_time", assessment.getBoundEndTime().toString());

                        notificationToUser.setPlaceholders(placeholders);
                        return notificationToUser;
                    }).collect(Collectors.toList());

            notificationDTO.setUsers(notificationToUsers);
            notificationService.sendEmailToUsers(notificationDTO);
        }
    }

    public void sendNotificationsToAdminsAfterReleasingTheResult(Assessment assessment, String instituteId) {

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(AssessmentNotificaionEmailBody.getEmailBodyForAdminsForResultRelease(assessment.getName(), assessment.getBoundStartTime().toString()));
        notificationDTO.setSource(NotificationSourceEnum.ASSESSMENT.name());
        notificationDTO.setSubject("Assessment result released");
        notificationDTO.setSourceId(assessment.getId());
        notificationDTO.setNotificationType(NotificationType.EMAIL.name());
        List<UserWithRolesDTO>users = authService.getUsersByRoles(List.of("ADMIN"),instituteId);
        List<NotificationToUserDTO> notificationToUsers = users.stream()
                .map(user -> {
                    NotificationToUserDTO notificationToUser = new NotificationToUserDTO();
                    notificationToUser.setUserId(user.getId());
                    notificationToUser.setChannelId(user.getEmail());

                    Map<String, String> placeholders = new HashMap<>();
                    placeholders.put("user_name", user.getFullName());
                    notificationToUser.setPlaceholders(placeholders);
                    return notificationToUser;
                }).collect(Collectors.toList());

        notificationDTO.setUsers(notificationToUsers);
        notificationService.sendEmailToUsers(notificationDTO);
    }


}
