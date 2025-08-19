package vacademy.io.admin_core_service.features.institute_learner.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.notification.config.NotificationConfig;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.enums.NotificationSourceEnum;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LearnerEnrollmentNotificationService {

    private final NotificationService notificationService;
    private final InstituteRepository instituteRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(10);

    public void sendLearnerEnrollmentNotification(List<InstituteStudentDTO> students, String instituteId) {
        // Submit the task to the thread pool
        executor.submit(() -> {
            try {
                Institute institute = fetchInstitute(instituteId);
                NotificationDTO notificationDTO = createNotificationDTO(institute, students);
                notificationService.sendEmailToUsers(notificationDTO,instituteId);
            } catch (Exception e) {
                // Handle exceptions (e.g., log the error)
                e.printStackTrace();
            }
        });
    }

    private Institute fetchInstitute(String instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found"));
    }

    private NotificationDTO createNotificationDTO(Institute institute, List<InstituteStudentDTO> students) {
        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setSubject("Welcome to " + institute.getInstituteName());
        notificationDTO.setBody(LearnerEnrollmentEmailBody.NEW_CREDENTIALS_EMAIL_TEMPLATE);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSource(NotificationSourceEnum.INSTITUTE.name());
        notificationDTO.setSourceId(institute.getId());
        notificationDTO.setUsers(createUserNotifications(students, institute));
        return notificationDTO;
    }

    private List<NotificationToUserDTO> createUserNotifications(List<InstituteStudentDTO> students, Institute institute) {
        return students.stream()
                .map(student -> createNotificationToUserDTO(student, institute))
                .collect(Collectors.toList());
    }

    private NotificationToUserDTO createNotificationToUserDTO(InstituteStudentDTO student, Institute institute) {
        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setUserId(student.getUserDetails().getId());
        notificationToUserDTO.setChannelId(student.getUserDetails().getEmail());
        notificationToUserDTO.setPlaceholders(createPlaceholders(student, institute));
        return notificationToUserDTO;
    }

    private Map<String, String> createPlaceholders(InstituteStudentDTO student, Institute institute) {
        return Map.of(
                "STUDENT_NAME", student.getUserDetails().getFullName(),
                "USERNAME", student.getUserDetails().getUsername(),
                "PASSWORD", student.getUserDetails().getPassword(),
                "INSTITUTE_NAME", institute.getInstituteName(),
                "LOGIN_URL", NotificationConfig.INSTITUTE_LEARNER_LOGIN_URL
        );
    }
}