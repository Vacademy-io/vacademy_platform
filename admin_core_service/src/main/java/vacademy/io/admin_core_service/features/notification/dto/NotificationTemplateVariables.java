package vacademy.io.admin_core_service.features.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationTemplateVariables {

    // User details
    private String userName;
    private String userEmail;
    private String userMobile;
    private String userFullName;

    // Package details
    private String packageName;
    private String packageId;
    private String courseDescription;
    private String courseThumbnail;

    // Institute details
    private String instituteName;
    private String instituteId;

    // Payment details
    private String paymentType;
    private String paymentAmount;
    private String paymentStatus;

    // Enroll invite details
    private String enrollInviteCode;
    private String enrollInviteExpiryDate;

    // Additional context
    private String packageSessionId;
    private String levelName;
    private String sessionName;

    /**
     * Factory method to create variables from entities
     */
    public static NotificationTemplateVariables fromEntities(
            UserDTO user,
            PackageEntity packageEntity,
            Institute institute,
            PaymentOption paymentOption,
            EnrollInvite enrollInvite,
            String packageSessionId,
            String levelName,
            String sessionName) {

        return NotificationTemplateVariables.builder()
                // User details
                .userName(user.getUsername())
                .userEmail(user.getEmail())
                .userMobile(user.getMobileNumber())
                .userFullName(user.getFullName())

                // Package details
                .packageName(packageEntity.getPackageName())
                .packageId(packageEntity.getId())
                .courseDescription(packageEntity.getCourseHtmlDescription())
                .courseThumbnail(packageEntity.getThumbnailFileId())

                // Institute details
                .instituteName(institute.getInstituteName())
                .instituteId(institute.getId())


                .paymentType(paymentOption != null ? paymentOption.getType() : "ENROLLMENT")
                .paymentAmount("0") // PaymentOption doesn't have amount field, get from PaymentPlan if needed
                .paymentStatus("PENDING") // Default status

                // Enroll invite details
                .enrollInviteCode(enrollInvite != null ? enrollInvite.getInviteCode() : "")
                .enrollInviteExpiryDate(enrollInvite != null && enrollInvite.getEndDate() != null ?
                        enrollInvite.getEndDate().toString() : "")

                // Additional context
                .packageSessionId(packageSessionId)
                .levelName(levelName)
                .sessionName(sessionName)
                .build();
    }
}
