package vacademy.io.admin_core_service.features.institute_learner.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDTO;
import vacademy.io.admin_core_service.features.notification.config.NotificationConfig;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.enums.NotificationSourceEnum;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.notification_service.service.SendUniqueLinkService;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LearnerEnrollmentNotificationService {

    private final NotificationService notificationService;
    private final InstituteRepository instituteRepository;
    private final ExecutorService executor = Executors.newFixedThreadPool(10);
    private final SendUniqueLinkService sendUniqueLinkService;
    private final DynamicNotificationService dynamicNotificationService;
    private final EnrollInviteService enrollInviteService;


    public void sendLearnerEnrollmentNotification(List<InstituteStudentDTO> students, String instituteId) {
        // Submit the task to the thread pool
        executor.submit(() -> {
            try {
                Institute institute = fetchInstitute(instituteId);
                NotificationDTO notificationDTO = createNotificationDTO(institute, students);
                //notificationService.sendEmailToUsers(notificationDTO,instituteId);
                for (InstituteStudentDTO student : students) {
                    if (student != null && student.getUserDetails() != null) {
                        // Send dynamic notification using packageSessionId
                        if (student.getInstituteStudentDetails() != null &&
                                student.getInstituteStudentDetails().getPackageSessionId() != null) {

                            String packageSessionId = student.getInstituteStudentDetails().getPackageSessionId();

                            // Send dynamic notification using the same system as learner enrollment
                            dynamicNotificationService.sendDynamicNotification(
                                    NotificationEventType.LEARNER_ENROLL,
                                    packageSessionId,
                                    instituteId,
                                    student.getUserDetails(),
                                    null, // PaymentOption - not available in this context
                                    null  // EnrollInvite - not available in this context
                            );
                        }

                        // Send referral invitation email using packageSessionId
                        if (student.getInstituteStudentDetails() != null &&
                                student.getInstituteStudentDetails().getPackageSessionId() != null) {
                            
                            String packageSessionId = student.getInstituteStudentDetails().getPackageSessionId();
                            
                            try {
                                // Fetch default EnrollInvite by packageSessionId (returns Optional)
                                Optional<EnrollInviteDTO> enrollInviteDTOOptional = enrollInviteService.findDefaultEnrollInviteByPackageSessionIdOptional(
                                        packageSessionId, instituteId);
                                
                                if (enrollInviteDTOOptional.isPresent()) {
                                    EnrollInviteDTO enrollInviteDTO = enrollInviteDTOOptional.get();
                                    EnrollInvite enrollInvite = mapEnrollInviteDTOToEntity(enrollInviteDTO);
                                    
                                    // Send referral invitation notification
                                    dynamicNotificationService.sendReferralInvitationNotification(
                                            instituteId,
                                            student.getUserDetails(),
                                            enrollInvite
                                    );
                                } else {
                                    // Log info when no default enroll invite is found
                                    System.out.println("No default enroll invite found for package session: " + packageSessionId + 
                                            ", skipping referral invitation email for student: " + student.getUserDetails().getId());
                                }
                            } catch (Exception e) {
                                // Log error but don't fail the entire process
                                System.err.println("Error sending referral invitation email for student: " + 
                                        student.getUserDetails().getId() + ", error: " + e.getMessage());
                            }
                        }
                    }
                }
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

    /**
     * Maps EnrollInviteDTO to EnrollInvite entity for notification service
     * 
     * @param enrollInviteDTO The DTO to convert
     * @return EnrollInvite entity with necessary fields populated
     */
    private EnrollInvite mapEnrollInviteDTOToEntity(EnrollInviteDTO enrollInviteDTO) {
        EnrollInvite enrollInvite = new EnrollInvite();
        enrollInvite.setId(enrollInviteDTO.getId());
        enrollInvite.setInviteCode(enrollInviteDTO.getInviteCode());
        enrollInvite.setEndDate(enrollInviteDTO.getEndDate());
        enrollInvite.setStartDate(enrollInviteDTO.getStartDate());
        enrollInvite.setName(enrollInviteDTO.getName());
        enrollInvite.setStatus(enrollInviteDTO.getStatus());
        enrollInvite.setTag(enrollInviteDTO.getTag());
        enrollInvite.setInstituteId(enrollInviteDTO.getInstituteId());
        enrollInvite.setVendor(enrollInviteDTO.getVendor());
        enrollInvite.setVendorId(enrollInviteDTO.getVendorId());
        enrollInvite.setCurrency(enrollInviteDTO.getCurrency());
        enrollInvite.setLearnerAccessDays(enrollInviteDTO.getLearnerAccessDays());
        enrollInvite.setWebPageMetaDataJson(enrollInviteDTO.getWebPageMetaDataJson());
        enrollInvite.setIsBundled(enrollInviteDTO.getIsBundled());
        return enrollInvite;
    }
}