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
import java.util.Map;

/**
 * UserPlan-centric enrollment context.
 * Carries ALL data for a UserPlan and its associated mappings in a single pass.
 */
@Getter
@Builder
public class EnrolmentContext {
    // UserPlan-level data
    private final UserPlan userPlan;  // The UserPlan being processed
    private final List<StudentSessionInstituteGroupMapping> mappings;  // ALL mappings for this UserPlan (was allMappings)
    private final Map<String, EnrollmentPolicySettingsDTO> policiesByPackageSessionId;  // Package session ID → Policy
    
    // User context
    private final UserDTO user;  // ROOT_ADMIN for SUB_ORG, individual user for Individual

    public Date getStartDate() {
      return   userPlan.getStartDate();
    }

    public Date getEndDate() {
        return userPlan.getEndDate();
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
        // Return the MAXIMUM waiting period among all policies
        // This gives users the longest grace period if different package sessions have different settings
        return policiesByPackageSessionId.values().stream()
            .filter(p -> p.getOnExpiry() != null && p.getOnExpiry().getWaitingPeriodInDays() != null)
            .map(p -> p.getOnExpiry().getWaitingPeriodInDays())
            .max(Integer::compareTo)
            .orElse(0);
    }
    
    /**
     * Get policy for a specific package session
     */
    public EnrollmentPolicySettingsDTO getPolicyForPackageSession(String packageSessionId) {
        return policiesByPackageSessionId != null ? policiesByPackageSessionId.get(packageSessionId) : null;
    }
    
    /**
     * Check if this is a SUB_ORG UserPlan
     */
    public boolean isSubOrg() {
        return userPlan != null 
            && "SUB_ORG".equals(userPlan.getSource()) 
            && userPlan.getSubOrgId() != null;
    }
    
    /**
     * Get SubOrg ID if this is a SUB_ORG UserPlan
     */
    public String getSubOrgId() {
        return isSubOrg() ? userPlan.getSubOrgId() : null;
    }

    /**
     * Get all mappings (replaces getAllMappings())
     */
    public List<StudentSessionInstituteGroupMapping> getAllMappings() {
        return mappings;
    }
}
