package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.Builder;
import lombok.Getter;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.common.auth.dto.UserDTO;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

@Getter
@Builder
public class EnrolmentContext {
    private final StudentSessionInstituteGroupMapping mapping; // Current mapping being processed
    private final EnrollmentPolicySettingsDTO policy; // Policy for current mapping
    private final UserDTO user;
    private final UserPlan userPlan;
    private final List<StudentSessionInstituteGroupMapping> allMappings; // All ACTIVE mappings for this UserPlan

    public Date getStartDate() {
        // Use UserPlan startDate if available, otherwise fallback to mapping
        // enrolledDate
        if (userPlan != null && userPlan.getStartDate() != null) {
            return userPlan.getStartDate();
        }
        return mapping != null ? mapping.getEnrolledDate() : null;
    }

    public Date getEndDate() {
        // Use UserPlan endDate if available, otherwise fallback to mapping expiryDate
        if (userPlan != null && userPlan.getEndDate() != null) {
            return userPlan.getEndDate();
        }
        return mapping != null ? mapping.getExpiryDate() : null;
    }

    public UserDTO getUser() {
        return user;
    }

    public long getDaysUntilExpiry() {
        Date endDate = getEndDate();
        if (endDate == null) {
            return Long.MAX_VALUE;
        }
        LocalDate today = LocalDate.now();
        LocalDate expiry = Instant.ofEpochMilli(endDate.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDate();
        return ChronoUnit.DAYS.between(today, expiry);
    }

    public long getDaysPastExpiry() {
        Date endDate = getEndDate();
        if (endDate == null) {
            return Long.MIN_VALUE;
        }
        LocalDate today = LocalDate.now();
        LocalDate expiry = Instant.ofEpochMilli(endDate.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDate();
        return ChronoUnit.DAYS.between(expiry, today);
    }

    public Integer getWaitingPeriod() {
        if (policy.getOnExpiry() == null || policy.getOnExpiry().getWaitingPeriodInDays() == null) {
            return 0;
        }
        return policy.getOnExpiry().getWaitingPeriodInDays();
    }
}
