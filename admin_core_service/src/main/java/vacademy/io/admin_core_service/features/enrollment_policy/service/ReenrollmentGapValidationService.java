package vacademy.io.admin_core_service.features.enrollment_policy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.ReenrollmentPolicyDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * Service to validate re-enrollment gap before allowing enrollment.
 * Checks if the required gap period has passed since the last purchase.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReenrollmentGapValidationService {

    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Validates re-enrollment gap for a list of package sessions.
     * 
     * @param userId          User ID attempting to enroll
     * @param instituteId     Institute ID
     * @param packageSessions List of package sessions to enroll in
     * @param enrollmentDate  Date of enrollment (usually today)
     * @return ValidationResult containing allowed and blocked package sessions
     */
    public GapValidationResult validateGapForPackageSessions(
            String userId,
            String instituteId,
            List<PackageSession> packageSessions,
            Date enrollmentDate) {

        List<String> allowedPackageSessionIds = new ArrayList<>();
        List<GapBlockedPackageSession> blockedPackageSessions = new ArrayList<>();

        for (PackageSession packageSession : packageSessions) {
            GapValidationResult singleResult = validateGapForSinglePackageSession(
                    userId, instituteId, packageSession, enrollmentDate);

            if (singleResult.isAllowed()) {
                allowedPackageSessionIds.add(packageSession.getId());
            } else {
                blockedPackageSessions.add(new GapBlockedPackageSession(
                        packageSession.getId(),
                        singleResult.getRetryDate(),
                        singleResult.getGapInDays()));
            }
        }

        return GapValidationResult.builder()
                .allowed(!allowedPackageSessionIds.isEmpty())
                .allowedPackageSessionIds(allowedPackageSessionIds)
                .blockedPackageSessions(blockedPackageSessions)
                .build();
    }

    /**
     * Validates re-enrollment gap for a single package session.
     * 
     * @param userId         User ID attempting to enroll
     * @param instituteId    Institute ID
     * @param packageSession Package session to enroll in
     * @param enrollmentDate Date of enrollment (usually today)
     * @return ValidationResult with allowed status and retry date if blocked
     */
    public GapValidationResult validateGapForSinglePackageSession(
            String userId,
            String instituteId,
            PackageSession packageSession,
            Date enrollmentDate) {

        // Get enrollment policy from package session
        EnrollmentPolicySettingsDTO policy = parseEnrollmentPolicy(
                packageSession.getEnrollmentPolicySettings());

        if (policy == null || policy.getReenrollmentPolicy() == null) {
            // No policy or no re-enrollment policy - allow enrollment (current flow)
            log.debug("No re-enrollment policy found for package session: {}, allowing enrollment",
                    packageSession.getId());
            return GapValidationResult.builder()
                    .allowed(true)
                    .build();
        }

        ReenrollmentPolicyDTO reenrollmentPolicy = policy.getReenrollmentPolicy();
        Integer gapInDays = reenrollmentPolicy.getReenrollmentGapInDays();

        // If gap is null or 0, allow enrollment (current flow)
        if (gapInDays == null || gapInDays == 0) {
            log.debug("Re-enrollment gap is null or 0 for package session: {}, allowing enrollment",
                    packageSession.getId());
            return GapValidationResult.builder()
                    .allowed(true)
                    .build();
        }

        // Find the actual package session (destinationPackageSession if exists, else
        // packageSession)
        String actualPackageSessionId = getActualPackageSessionId(packageSession);

        // Find past purchases for the actual package session (all statuses)
        Optional<StudentSessionInstituteGroupMapping> lastPurchase = findLastPurchaseForPackageSession(
                userId, instituteId, actualPackageSessionId);

        if (!lastPurchase.isPresent()) {
            // No past purchase - allow enrollment
            log.debug("No past purchase found for package session: {}, allowing enrollment",
                    actualPackageSessionId);
            return GapValidationResult.builder()
                    .allowed(true)
                    .build();
        }

        StudentSessionInstituteGroupMapping lastMapping = lastPurchase.get();
        Date lastEndDate = getEndDate(lastMapping);

        if (lastEndDate == null) {
            // No end date in past purchase - allow enrollment
            log.debug("Last purchase has no end date for package session: {}, allowing enrollment",
                    actualPackageSessionId);
            return GapValidationResult.builder()
                    .allowed(true)
                    .build();
        }

        // Calculate gap from last end date
        LocalDate lastEndLocalDate = Instant.ofEpochMilli(lastEndDate.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDate();
        LocalDate enrollmentLocalDate = Instant.ofEpochMilli(enrollmentDate.getTime())
                .atZone(ZoneId.systemDefault())
                .toLocalDate();

        long daysSinceLastEnd = ChronoUnit.DAYS.between(lastEndLocalDate, enrollmentLocalDate);

        // Check if gap is maintained
        if (daysSinceLastEnd < gapInDays) {
            // Gap not maintained - calculate retry date
            LocalDate retryLocalDate = lastEndLocalDate.plusDays(gapInDays);
            Date retryDate = Date.from(retryLocalDate.atStartOfDay(ZoneId.systemDefault()).toInstant());

            log.info("Re-enrollment gap not maintained for package session: {}. Last end date: {}, " +
                    "Enrollment date: {}, Required gap: {} days, Days since last end: {} days. " +
                    "Retry date: {}",
                    actualPackageSessionId, lastEndDate, enrollmentDate, gapInDays, daysSinceLastEnd, retryDate);

            return GapValidationResult.builder()
                    .allowed(false)
                    .gapInDays(gapInDays)
                    .retryDate(retryDate)
                    .lastEndDate(lastEndDate)
                    .build();
        }

        // Gap is maintained - allow enrollment
        log.debug("Re-enrollment gap maintained for package session: {}. Days since last end: {} days, " +
                "Required gap: {} days",
                actualPackageSessionId, daysSinceLastEnd, gapInDays);

        return GapValidationResult.builder()
                .allowed(true)
                .build();
    }

    /**
     * Gets the actual package session ID (destinationPackageSession if exists, else
     * packageSession).
     * For finding past purchases, we need to check both:
     * 1. Mappings where packageSession matches (direct purchase)
     * 2. Mappings where destinationPackageSession matches (purchased through
     * another session)
     */
    private String getActualPackageSessionId(PackageSession packageSession) {
        return packageSession.getId();
    }

    /**
     * Finds the last purchase (mapping) for a package session.
     * Checks all statuses, not just ACTIVE.
     * Excludes ABANDONED_CART type entries as they represent unverified enrollments.
     * Looks for mappings where:
     * 1. packageSession.id = actualPackageSessionId (direct purchase)
     * 2. destinationPackageSession.id = actualPackageSessionId (purchased through
     * another session)
     */
    private Optional<StudentSessionInstituteGroupMapping> findLastPurchaseForPackageSession(
            String userId,
            String instituteId,
            String actualPackageSessionId) {

        // First, try to find by packageSession (direct purchase)
        Optional<StudentSessionInstituteGroupMapping> byPackageSession = mappingRepository
                .findByUserIdAndPackageSessionIdAndInstituteId(
                        userId, actualPackageSessionId, instituteId);

        // Filter out ABANDONED_CART type entries - they represent unverified enrollments
        // that shouldn't block re-enrollment attempts
        if (byPackageSession.isPresent() && !isAbandonedCartType(byPackageSession.get())) {
            return byPackageSession;
        }

        // If not found, try to find by destinationPackageSession
        // This means user purchased through another session that leads to this one
        Optional<StudentSessionInstituteGroupMapping> byDestination = mappingRepository.findLatestByDestinationPackageSessionIdAndStatusInAndUserId(
                actualPackageSessionId,
                List.of("ACTIVE", "EXPIRED", "TERMINATED", "INVITED", "INACTIVE"),
                userId);

        // Filter out ABANDONED_CART type entries from destination lookup as well
        if (byDestination.isPresent() && !isAbandonedCartType(byDestination.get())) {
            return byDestination;
        }

        return Optional.empty();
    }

    /**
     * Checks if a mapping is of ABANDONED_CART type.
     * ABANDONED_CART entries represent unverified enrollments that are pending user action
     * (e.g., WhatsApp verification) and should not be considered as actual enrollments.
     */
    private boolean isAbandonedCartType(StudentSessionInstituteGroupMapping mapping) {
        return mapping.getType() != null && 
               "ABANDONED_CART".equalsIgnoreCase(mapping.getType());
    }

    /**
     * Gets the end date from a mapping.
     * Uses expiryDate from mapping, or UserPlan endDate if available.
     */
    private Date getEndDate(StudentSessionInstituteGroupMapping mapping) {
        // First check mapping's expiryDate
        if (mapping.getExpiryDate() != null) {
            return mapping.getExpiryDate();
        }

        // If UserPlan is linked, we could check UserPlan.endDate
        // For now, return null if no expiryDate
        return null;
    }

    /**
     * Parses enrollment policy from JSON string.
     */
    private EnrollmentPolicySettingsDTO parseEnrollmentPolicy(String policyJson) {
        if (!StringUtils.hasText(policyJson)) {
            return null;
        }

        try {
            return objectMapper.readValue(policyJson, EnrollmentPolicySettingsDTO.class);
        } catch (Exception e) {
            log.warn("Failed to parse enrollment policy JSON: {}", policyJson, e);
            return null;
        }
    }

    /**
     * Result of gap validation for a single package session.
     */
    @lombok.Data
    @lombok.Builder
    public static class GapValidationResult {
        boolean allowed;
        Integer gapInDays;
        Date retryDate;
        Date lastEndDate;
        @lombok.Builder.Default
        List<String> allowedPackageSessionIds = new java.util.ArrayList<>();
        @lombok.Builder.Default
        List<GapBlockedPackageSession> blockedPackageSessions = new java.util.ArrayList<>();
    }

    /**
     * Information about a blocked package session due to gap violation.
     */
    @lombok.Value
    public static class GapBlockedPackageSession {
        String packageSessionId;
        Date retryDate;
        Integer gapInDays;
    }
}
