package vacademy.io.assessment_service.features.assessment.notification;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.notification.service.NotificationService;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class AssessmentReportNotificationService {

    @Autowired
    private NotificationService notificationService;

    public void sendAssessmentReportsToLearners(Map<StudentAttempt, byte[]> participantPdfReport, String assessmentId) {
        List<AttachmentUsersDTO> usersList = new ArrayList<>();

        for (Map.Entry<StudentAttempt, byte[]> entry : participantPdfReport.entrySet()) {
            StudentAttempt studentAttempt = entry.getKey();
            byte[] reportData = entry.getValue();

            AttachmentUsersDTO user = new AttachmentUsersDTO();
            user.setChannelId(studentAttempt.getRegistration().getUserEmail());
            user.setUserId(studentAttempt.getRegistration().getUserId());
            user.setPlaceholders(Map.of("learner_name", studentAttempt.getRegistration().getParticipantName()));
            // Convert byte[] to Base64 String
            String encodedAttachment = Base64.getEncoder().encodeToString(reportData);
            AttachmentUsersDTO.AttachmentDTO attachment = new AttachmentUsersDTO.AttachmentDTO();
            attachment.setAttachmentName("report.pdf");
            user.setAttachments(List.of(attachment));

            usersList.add(user);
        }

        AttachmentNotificationDTO attachmentNotificationDTO = getAttachmentNotificationDTO(usersList, assessmentId);
        sendNotification(attachmentNotificationDTO);
    }

    private AttachmentNotificationDTO getAttachmentNotificationDTO(List<AttachmentUsersDTO> usersList, String assessmentId) {
        AttachmentNotificationDTO attachmentNotificationDTO =
                AttachmentNotificationDTO.builder().build();
        attachmentNotificationDTO.setBody(AssessmentNotificationEmailBody.getAssessmentReportBody());
        attachmentNotificationDTO.setSubject("Assessment Report");
        attachmentNotificationDTO.setSource("ASSESSMENT_REPORT");
        attachmentNotificationDTO.setSourceId(assessmentId);
        attachmentNotificationDTO.setNotificationType("EMAIL");
        attachmentNotificationDTO.setUsers(usersList);
        return attachmentNotificationDTO;
    }

    private void sendNotification(AttachmentNotificationDTO notificationDTO) {
        notificationService.sendAttachmentEmailToUsers(notificationDTO);
    }
}
