package vacademy.io.admin_core_service.features.course.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.course.dto.bulk.*;
import vacademy.io.admin_core_service.features.course.enums.CourseTypeEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.entity.PackageSessionLearnerInvitationToPaymentOption;
import vacademy.io.admin_core_service.features.enroll_invite.enums.EnrollInviteTag;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteCoursePreviewService;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.learner_invitation.dto.AddLearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.learner_invitation.util.LearnerInvitationDefaultFormGenerator;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.admin_core_service.features.session.enums.SessionStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionSource;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.PackageInstitute;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.security.SecureRandom;
import java.sql.Date;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for bulk course creation operations.
 * Handles creation of courses, package sessions, payment options, and enroll
 * invites in bulk.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BulkCourseService {

    private final PackageRepository packageRepository;
    private final PackageInstituteRepository packageInstituteRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final LevelRepository levelRepository;
    private final SessionRepository sessionRepository;
    private final InstituteRepository instituteRepository;
    private final PaymentOptionRepository paymentOptionRepository;
    private final PaymentPlanRepository paymentPlanRepository;
    private final PaymentOptionService paymentOptionService;
    private final EnrollInviteRepository enrollInviteRepository;
    private final PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;
    private final EnrollInviteCoursePreviewService enrollInviteCoursePreviewService;
    private final LearnerInvitationService learnerInvitationService;
    private final InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;
    private final InstituteCustomFiledService instituteCustomFiledService;

    private static final String DEFAULT_LEVEL_ID = "DEFAULT";
    private static final String DEFAULT_SESSION_ID = "DEFAULT";
    private static final String INVITED_LEVEL_ID = "INVITED";
    private static final String INVITED_SESSION_ID = "INVITED";

    /**
     * Process bulk course creation request.
     * Each course is processed independently - failures don't affect other courses.
     */
    public BulkAddCourseResponseDTO bulkAddCourses(
            BulkAddCourseRequestDTO request,
            String instituteId,
            CustomUserDetails user) {

        List<BulkCourseItemDTO> courses = request.getCourses();
        if (courses == null || courses.isEmpty()) {
            return BulkAddCourseResponseDTO.builder()
                    .totalRequested(0)
                    .successCount(0)
                    .failureCount(0)
                    .dryRun(request.isDryRun())
                    .results(List.of())
                    .build();
        }

        BulkCourseGlobalDefaultsDTO globalDefaults = request.getApplyToAllOrEmpty();
        BulkAddCourseResponseDTO response = new BulkAddCourseResponseDTO();
        response.setTotalRequested(courses.size());
        response.setDryRun(request.isDryRun());
        response.setResults(new ArrayList<>());

        for (int i = 0; i < courses.size(); i++) {
            BulkCourseItemDTO courseItem = courses.get(i);
            BulkCourseResultDTO result = processSingleCourse(i, courseItem, globalDefaults, instituteId, user,
                    request.isDryRun());
            response.addResult(result);
        }

        return response;
    }

    /**
     * Process a single course creation within the bulk operation.
     * Uses @Transactional with REQUIRES_NEW to isolate each course creation,
     * so one failure doesn't roll back other courses.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public BulkCourseResultDTO processSingleCourse(
            int index,
            BulkCourseItemDTO courseItem,
            BulkCourseGlobalDefaultsDTO globalDefaults,
            String instituteId,
            CustomUserDetails user,
            boolean dryRun) {

        String courseName = courseItem.getCourseName();

        try {
            // Validate required fields
            if (!StringUtils.hasText(courseName)) {
                return BulkCourseResultDTO.failure(index, courseName, "Course name is required");
            }

            // Resolve effective configurations (course-level > global > system defaults)
            String effectiveCourseType = resolveString(courseItem.getCourseType(),
                    globalDefaults.getEffectiveCourseType(), CourseTypeEnum.DEFAULT);
            int effectiveCourseDepth = resolveInteger(courseItem.getCourseDepth(),
                    globalDefaults.getCourseDepth(), 5);
            List<String> effectiveTags = resolveTags(courseItem.getTags(), globalDefaults.getTags());
            Boolean effectivePublishToCatalogue = resolveBoolean(courseItem.getPublishToCatalogue(),
                    globalDefaults.getPublishToCatalogue(), false);

            List<BulkCourseBatchDTO> effectiveBatches = resolveBatches(courseItem.getBatches(),
                    globalDefaults.getBatches());
            BulkCoursePaymentConfigDTO effectivePaymentConfig = resolvePaymentConfig(courseItem.getPaymentConfig(),
                    globalDefaults.getPaymentConfig());
            BulkCourseInventoryConfigDTO effectiveInventoryConfig = resolveInventoryConfig(
                    courseItem.getInventoryConfig(),
                    globalDefaults.getInventoryConfig());

            if (dryRun) {
                // Validate but don't persist
                return BulkCourseResultDTO.success(index, courseName, "DRY_RUN_VALIDATED",
                        List.of(), List.of(), null);
            }

            // 1. Create Package (Course)
            PackageEntity packageEntity = createPackageEntity(courseItem, effectiveCourseType,
                    effectiveCourseDepth, effectiveTags, effectivePublishToCatalogue, user);
            packageEntity = packageRepository.save(packageEntity);

            // 2. Create PackageInstitute mapping
            createPackageInstitute(packageEntity, instituteId);

            // 2.5. Create INVITED PackageSession for the package
            createInvitedPackageSession(packageEntity);

            // 4. Create PackageSessions (Batches) and EnrollInvites
            List<String> packageSessionIds = new ArrayList<>();
            List<String> enrollInviteIds = new ArrayList<>();
            String lastPaymentOptionId = null;

            for (BulkCourseBatchDTO batch : effectiveBatches) {
                // Resolve inventory for this specific batch
                BulkCourseInventoryConfigDTO batchInventory = batch.getInventoryConfig() != null
                        ? batch.getInventoryConfig()
                        : effectiveInventoryConfig;

                // Resolve payment config for this specific batch
                BulkCoursePaymentConfigDTO batchPaymentConfig = resolvePaymentConfig(batch.getPaymentConfig(),
                        effectivePaymentConfig);

                // Resolve or Create Payment Option for this batch
                PaymentOption batchPaymentOption = resolveOrCreatePaymentOption(batchPaymentConfig, instituteId,
                        courseName);
                if (batchPaymentOption != null) {
                    lastPaymentOptionId = batchPaymentOption.getId();
                }

                PackageSession packageSession = createPackageSession(packageEntity, batch,
                        batchInventory, instituteId);
                packageSessionIds.add(packageSession.getId());

                // Create EnrollInvite for this batch
                EnrollInvite enrollInvite = createEnrollInviteForBatch(packageSession, batchPaymentOption, instituteId);
                enrollInviteIds.add(enrollInvite.getId());

                // Create learner invitation form
                createLearnerInvitationFormAsync(packageSession, instituteId, user);
            }

            return BulkCourseResultDTO.success(index, courseName, packageEntity.getId(),
                    packageSessionIds, enrollInviteIds,
                    lastPaymentOptionId);

        } catch (Exception e) {
            log.error("Failed to create course at index {}: {}", index, courseName, e);
            return BulkCourseResultDTO.failure(index, courseName, e.getMessage());
        }
    }

    // ==================== Helper Methods ====================

    private PackageEntity createPackageEntity(BulkCourseItemDTO item, String courseType,
            int courseDepth, List<String> tags,
            boolean publishToCatalogue, CustomUserDetails user) {
        PackageEntity entity = new PackageEntity();
        entity.setPackageName(item.getCourseName());
        entity.setStatus(PackageStatusEnum.ACTIVE.name());
        entity.setCourseDepth(courseDepth);
        entity.setIsCoursePublishedToCatalaouge(publishToCatalogue);

        // Set tags as comma-separated string
        if (tags != null && !tags.isEmpty()) {
            entity.setTags(tags.stream()
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .collect(Collectors.joining(",")));
        }

        // Set optional media fields
        if (StringUtils.hasText(item.getThumbnailFileId())) {
            entity.setThumbnailFileId(item.getThumbnailFileId());
        }
        if (StringUtils.hasText(item.getCoursePreviewImageMediaId())) {
            entity.setCoursePreviewImageMediaId(item.getCoursePreviewImageMediaId());
        }
        if (StringUtils.hasText(item.getCourseBannerMediaId())) {
            entity.setCourseBannerMediaId(item.getCourseBannerMediaId());
        }
        if (StringUtils.hasText(item.getCourseMediaId())) {
            entity.setCourseMediaId(item.getCourseMediaId());
        }
        if (StringUtils.hasText(item.getWhyLearnHtml())) {
            entity.setWhyLearn(item.getWhyLearnHtml());
        }
        if (StringUtils.hasText(item.getWhoShouldLearnHtml())) {
            entity.setWhoShouldLearn(item.getWhoShouldLearnHtml());
        }
        if (StringUtils.hasText(item.getAboutTheCourseHtml())) {
            entity.setAboutTheCourse(item.getAboutTheCourseHtml());
        }
        if (StringUtils.hasText(item.getCourseHtmlDescription())) {
            entity.setCourseHtmlDescription(item.getCourseHtmlDescription());
        }

        // Set user who created this course
        if (user != null) {
            entity.setCreatedByUserId(user.getId());
        }

        entity.setVersionNumber(1);

        // Set package/course type
        entity.setPackageType(courseType);

        return entity;
    }

    private void createPackageInstitute(PackageEntity packageEntity, String instituteId) {
        Optional<PackageInstitute> existing = packageInstituteRepository
                .findByPackageIdAndInstituteId(packageEntity.getId(), instituteId);

        if (existing.isEmpty()) {
            PackageInstitute packageInstitute = new PackageInstitute();
            packageInstitute.setPackageEntity(packageEntity);
            packageInstitute.setInstituteEntity(instituteRepository.findById(instituteId)
                    .orElseThrow(() -> new RuntimeException("Institute not found: " + instituteId)));
            packageInstituteRepository.save(packageInstitute);
        }
    }

    /**
     * Creates an INVITED PackageSession for the package.
     * This is similar to PackageSessionService.addInvitedPackageSessionForPackage()
     * and is used to track learners who are invited but not yet enrolled in a
     * specific batch.
     */
    private void createInvitedPackageSession(PackageEntity packageEntity) {
        Session session = new Session();
        Level level = new Level();
        session.setId(INVITED_SESSION_ID);
        level.setId(INVITED_LEVEL_ID);

        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setLevel(level);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setStatus(PackageSessionStatusEnum.INVITED.name());
        packageSessionRepository.save(packageSession);
    }

    private PackageSession createPackageSession(PackageEntity packageEntity,
            BulkCourseBatchDTO batch,
            BulkCourseInventoryConfigDTO inventoryConfig,
            String instituteId) {
        // Resolve Level
        Level level = resolveLevel(batch.getLevelId(), instituteId);

        // Resolve Session
        Session session = resolveSession(batch.getSessionId(), instituteId);

        PackageSession packageSession = new PackageSession();
        packageSession.setPackageEntity(packageEntity);
        packageSession.setLevel(level);
        packageSession.setSession(session);
        packageSession.setStatus(PackageSessionStatusEnum.ACTIVE.name());
        packageSession.setStartTime(new java.util.Date());
        packageSession.setIsParent(batch.getIsParent() != null ? batch.getIsParent() : false);
        packageSession.setParentId(batch.getParentId());

        // Set inventory if provided
        if (inventoryConfig != null && inventoryConfig.getMaxSlots() != null) {
            packageSession.setMaxSeats(inventoryConfig.getMaxSlots());
            packageSession.setAvailableSlots(inventoryConfig.getEffectiveAvailableSlots());
        }

        return packageSessionRepository.save(packageSession);
    }

    private Level resolveLevel(String levelId, String instituteId) {
        if (!StringUtils.hasText(levelId) || DEFAULT_LEVEL_ID.equalsIgnoreCase(levelId)) {
            return levelRepository.findById(DEFAULT_LEVEL_ID)
                    .orElseGet(() -> {
                        Level defaultLevel = new Level();
                        defaultLevel.setId(DEFAULT_LEVEL_ID);
                        defaultLevel.setLevelName("Default");
                        defaultLevel.setStatus(LevelStatusEnum.ACTIVE.name());
                        return levelRepository.save(defaultLevel);
                    });
        }
        return levelRepository.findById(levelId)
                .orElseThrow(() -> new RuntimeException("Level not found: " + levelId));
    }

    private Session resolveSession(String sessionId, String instituteId) {
        if (!StringUtils.hasText(sessionId) || DEFAULT_SESSION_ID.equalsIgnoreCase(sessionId)) {
            return sessionRepository.findById(DEFAULT_SESSION_ID)
                    .orElseGet(() -> {
                        Session defaultSession = new Session();
                        defaultSession.setId(DEFAULT_SESSION_ID);
                        defaultSession.setSessionName("Default");
                        defaultSession.setStatus(SessionStatusEnum.ACTIVE.name());
                        return sessionRepository.save(defaultSession);
                    });
        }
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));
    }

    private PaymentOption resolveOrCreatePaymentOption(BulkCoursePaymentConfigDTO config,
            String instituteId,
            String courseName) {
        if (config == null) {
            // Use institute default
            return paymentOptionService.getPaymentOption(
                    PaymentOptionSource.INSTITUTE.name(),
                    instituteId,
                    PaymentOptionTag.DEFAULT.name(),
                    List.of(StatusEnum.ACTIVE.name())).orElse(null);
        }

        // If paymentOptionId is provided, use existing
        if (StringUtils.hasText(config.getPaymentOptionId())) {
            return paymentOptionService.findById(config.getPaymentOptionId());
        }

        // Create new payment option based on type
        String paymentType = config.getPaymentType();
        if (!StringUtils.hasText(paymentType)) {
            // No type specified, use institute default
            return paymentOptionService.getPaymentOption(
                    PaymentOptionSource.INSTITUTE.name(),
                    instituteId,
                    PaymentOptionTag.DEFAULT.name(),
                    List.of(StatusEnum.ACTIVE.name())).orElse(null);
        }

        return createPaymentOption(config, instituteId, courseName);
    }

    private PaymentOption createPaymentOption(BulkCoursePaymentConfigDTO config,
            String instituteId,
            String courseName) {
        PaymentOption paymentOption = new PaymentOption();
        paymentOption.setName(StringUtils.hasText(config.getPaymentOptionName())
                ? config.getPaymentOptionName()
                : courseName + " - " + config.getPaymentType());
        paymentOption.setStatus(StatusEnum.ACTIVE.name());
        paymentOption.setSource(PaymentOptionSource.PACKAGE_SESSION.name());
        paymentOption.setSourceId(instituteId); // Will be updated per package session if needed
        paymentOption.setType(config.getPaymentType().toUpperCase());
        paymentOption.setRequireApproval(config.isEffectiveRequireApproval());

        paymentOption = paymentOptionRepository.save(paymentOption);

        // Create payment plan if not FREE
        if (!PaymentOptionType.FREE.name().equalsIgnoreCase(config.getPaymentType())) {
            PaymentPlan plan = new PaymentPlan();
            plan.setName(StringUtils.hasText(config.getPlanName())
                    ? config.getPlanName()
                    : courseName + " Plan");
            plan.setStatus(StatusEnum.ACTIVE.name());
            plan.setActualPrice(config.getPrice() != null ? config.getPrice() : 0.0);
            plan.setElevatedPrice(config.getEffectiveElevatedPrice());
            plan.setCurrency(config.getEffectiveCurrency());
            plan.setValidityInDays(config.getEffectiveValidityInDays());
            plan.setPaymentOption(paymentOption);

            paymentPlanRepository.save(plan);
            paymentOption.setPaymentPlans(List.of(plan));
        }

        return paymentOption;
    }

    private EnrollInvite createEnrollInviteForBatch(PackageSession packageSession,
            PaymentOption paymentOption,
            String instituteId) {
        EnrollInvite enrollInvite = new EnrollInvite();
        enrollInvite.setName(getNameForEnrollInvite(packageSession));
        enrollInvite.setStartDate(new Date(System.currentTimeMillis()));
        enrollInvite.setEndDate(null);
        enrollInvite.setInviteCode(generateInviteCode());
        enrollInvite.setStatus(StatusEnum.ACTIVE.name());
        enrollInvite.setInstituteId(instituteId);

        // Get vendor info from InstitutePaymentGatewayMapping (latest by createdAt),
        // fallback to STRIPE
        InstitutePaymentGatewayMappingService.VendorInfo vendorInfo = institutePaymentGatewayMappingService
                .getLatestVendorInfoForInstitute(instituteId);
        enrollInvite.setVendor(vendorInfo.getVendor());
        enrollInvite.setVendorId(vendorInfo.getVendorId());
        enrollInvite.setTag(EnrollInviteTag.DEFAULT.name());

        // Set currency from payment plan if available
        if (paymentOption != null && paymentOption.getPaymentPlans() != null
                && !paymentOption.getPaymentPlans().isEmpty()) {
            enrollInvite.setCurrency(paymentOption.getPaymentPlans().get(0).getCurrency());
        }

        enrollInvite.setWebPageMetaDataJson(
                enrollInviteCoursePreviewService.createPreview(packageSession.getId(), instituteId));

        enrollInvite = enrollInviteRepository.save(enrollInvite);

        // Automatically copy default custom fields to the new enroll invite
        instituteCustomFiledService.copyDefaultCustomFieldsToEnrollInvite(instituteId, enrollInvite.getId());

        // Create junction table entry
        if (paymentOption != null) {
            PackageSessionLearnerInvitationToPaymentOption junction = new PackageSessionLearnerInvitationToPaymentOption(
                    enrollInvite, packageSession, paymentOption, StatusEnum.ACTIVE.name());
            packageSessionEnrollInviteToPaymentOptionService.create(junction);
        }

        return enrollInvite;
    }

    private void createLearnerInvitationFormAsync(PackageSession packageSession,
            String instituteId,
            CustomUserDetails user) {
        try {
            AddLearnerInvitationDTO dto = LearnerInvitationDefaultFormGenerator
                    .generateSampleInvitation(packageSession, instituteId);
            learnerInvitationService.createLearnerInvitationCode(dto, user);
        } catch (Exception e) {
            log.warn("Failed to create learner invitation form for package session: {}",
                    packageSession.getId(), e);
        }
    }

    // ==================== Resolution Helpers ====================

    private String resolveString(String primary, String secondary, String defaultValue) {
        if (StringUtils.hasText(primary))
            return primary;
        if (StringUtils.hasText(secondary))
            return secondary;
        return defaultValue;
    }

    private int resolveInteger(Integer primary, Integer secondary, int defaultValue) {
        if (primary != null)
            return primary;
        if (secondary != null)
            return secondary;
        return defaultValue;
    }

    private boolean resolveBoolean(Boolean primary, Boolean secondary, boolean defaultValue) {
        if (primary != null)
            return primary;
        if (secondary != null)
            return secondary;
        return defaultValue;
    }

    private List<String> resolveTags(List<String> courseTags, List<String> globalTags) {
        Set<String> tags = new LinkedHashSet<>();
        if (courseTags != null)
            tags.addAll(courseTags);
        if (globalTags != null)
            tags.addAll(globalTags);
        return new ArrayList<>(tags);
    }

    private List<BulkCourseBatchDTO> resolveBatches(List<BulkCourseBatchDTO> courseBatches,
            List<BulkCourseBatchDTO> globalBatches) {
        if (courseBatches != null && !courseBatches.isEmpty()) {
            return courseBatches;
        }
        if (globalBatches != null && !globalBatches.isEmpty()) {
            return globalBatches;
        }
        // Return default batch
        return List.of(BulkCourseBatchDTO.builder()
                .levelId(DEFAULT_LEVEL_ID)
                .sessionId(DEFAULT_SESSION_ID)
                .build());
    }

    private BulkCoursePaymentConfigDTO resolvePaymentConfig(BulkCoursePaymentConfigDTO courseConfig,
            BulkCoursePaymentConfigDTO globalConfig) {
        if (courseConfig != null)
            return courseConfig;
        return globalConfig; // Can be null, which means use institute default
    }

    private BulkCourseInventoryConfigDTO resolveInventoryConfig(BulkCourseInventoryConfigDTO courseConfig,
            BulkCourseInventoryConfigDTO globalConfig) {
        if (courseConfig != null)
            return courseConfig;
        return globalConfig; // Can be null, which means unlimited
    }

    private String getNameForEnrollInvite(PackageSession packageSession) {
        StringBuilder sb = new StringBuilder();
        Level level = packageSession.getLevel();
        Session session = packageSession.getSession();
        PackageEntity pkg = packageSession.getPackageEntity();

        if (level != null && !DEFAULT_LEVEL_ID.equalsIgnoreCase(level.getId())) {
            sb.append(level.getLevelName()).append(" ");
        }
        if (pkg != null) {
            sb.append(pkg.getPackageName()).append(" ");
        }
        if (session != null && !DEFAULT_SESSION_ID.equalsIgnoreCase(session.getId())) {
            sb.append(session.getSessionName());
        }
        return sb.toString().trim();
    }

    private String generateInviteCode() {
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

}
