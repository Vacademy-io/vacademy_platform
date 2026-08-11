package vacademy.io.admin_core_service.features.certificate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.certificate.dao.CourseCertificateDao;
import vacademy.io.admin_core_service.features.certificate.dto.CourseCertificateDashboardDto;
import vacademy.io.admin_core_service.features.certificate.dto.CourseCertificateLearnerDto;
import vacademy.io.admin_core_service.features.certificate.dto.CourseCertificateSettingDto;
import vacademy.io.admin_core_service.features.certificate.dto.CourseCertificateSettingsResponse;
import vacademy.io.admin_core_service.features.certificate.dto.ResolvedCertificateConfig;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.notification.CertificateIssuedNotificationService;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.course_settings.service.PackageSettingService;
import vacademy.io.admin_core_service.features.institute.dto.CertificationGenerationRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.manager.InstituteCertificateManager;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * Admin-facing certificate management for one course: settings, dashboard,
 * per-learner list and the row actions.
 *
 * <p>None of this existed before — the only certificate reads were learner- and
 * parent-scoped, so an admin had no way to see who had been issued what.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CourseCertificateService {

    private final CertificateSettingsResolver certificateSettingsResolver;
    private final PackageSettingService packageSettingService;
    private final CourseCertificateDao courseCertificateDao;
    private final IssuedCertificateRepository issuedCertificateRepository;
    private final InstituteRepository instituteRepository;
    private final InstituteCertificateManager instituteCertificateManager;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final CertificateIssuedNotificationService notificationService;
    private final MediaService mediaService;
    private final AuthService authService;

    // ---------------------------------------------------------------- settings

    public CourseCertificateSettingsResponse getSettings(String instituteId, String packageId) {
        Institute institute = loadInstitute(instituteId);

        ResolvedCertificateConfig instituteOnly = certificateSettingsResolver.resolve(
                institute, null, CertificateTypeEnum.COURSE_COMPLETION.name());
        ResolvedCertificateConfig effective = certificateSettingsResolver.resolve(
                institute, packageId, CertificateTypeEnum.COURSE_COMPLETION.name());
        CourseCertificateSettingDto override = certificateSettingsResolver.getCourseOverride(packageId);

        return CourseCertificateSettingsResponse.builder()
                .effectiveEnabled(effective.isEnabled())
                .effectiveThresholdPercent(effective.getThresholdPercent())
                .instituteEnabled(instituteOnly.isEnabled())
                .instituteThresholdPercent(instituteOnly.getThresholdPercent())
                .courseOverride(override)
                .enabledOverriddenByCourse(effective.isEnabledOverriddenByCourse())
                .thresholdOverriddenByCourse(effective.isThresholdOverriddenByCourse())
                .hasCourseTemplate(override != null && StringUtils.hasText(override.getTemplateHtml()))
                .build();
    }

    /**
     * Persist the per-course override. Stored through the existing
     * {@link PackageSettingService}, whose per-key upsert leaves the course's other
     * settings (LMS, drip, completion) untouched.
     */
    public void saveSettings(String instituteId, String packageId, CourseCertificateSettingDto request) {
        loadInstitute(instituteId);
        if (!StringUtils.hasText(packageId)) {
            throw new VacademyException("packageId is required");
        }
        if (request != null && request.getThresholdPercent() != null
                && (request.getThresholdPercent() < 0 || request.getThresholdPercent() > 100)) {
            throw new VacademyException("thresholdPercent must be between 0 and 100");
        }
        packageSettingService.saveGenericSetting(
                packageId,
                CertificateSettingsResolver.CERTIFICATE_SETTING_KEY,
                GenericSettingRequest.builder()
                        .settingName("Certificate Setting")
                        .settingData(request)
                        .build());
    }

    // --------------------------------------------------------------- dashboard

    public CourseCertificateDashboardDto getDashboard(String instituteId, String packageSessionId, String packageId) {
        int threshold = resolveThreshold(instituteId, packageId);
        return courseCertificateDao.dashboard(packageSessionId, instituteId, threshold);
    }

    public LearnerPage getLearners(String instituteId, String packageSessionId, String packageId,
                                   String search, String status, int page, int size) {
        int threshold = resolveThreshold(instituteId, packageId);
        List<CourseCertificateLearnerDto> rows =
                courseCertificateDao.learners(packageSessionId, instituteId, search, status, threshold, page, size);
        long total = courseCertificateDao.countLearners(packageSessionId, instituteId, search, status, threshold);

        // Resolve a public URL per issued certificate so the table can preview and
        // download without a second round trip per row.
        rows.forEach(row -> {
            if (StringUtils.hasText(row.getFileId())) {
                try {
                    row.setFileId(mediaService.getFilePublicUrlById(row.getFileId()));
                } catch (Exception e) {
                    log.warn("Could not resolve certificate file url for {}", row.getFileId(), e);
                }
            }
        });

        int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 0;
        return new LearnerPage(rows, page, size, total, totalPages, page >= totalPages - 1);
    }

    // ----------------------------------------------------------------- actions

    /**
     * Issue or re-issue for one learner. Delegates to the same manager the learner
     * flow uses, so the eligibility gate, numbering and audit trail behave
     * identically no matter who triggered it.
     */
    public String issueForLearner(CustomUserDetails user, String instituteId, String packageSessionId,
                                  String userId, boolean regenerate, String courseName) {
        if (mappingRepository.findByUserIdAndPackageSessionIdAndInstituteId(userId, packageSessionId, instituteId)
                .isEmpty()) {
            throw new VacademyException(HttpStatus.NOT_FOUND, "Learner is not enrolled in this batch");
        }
        CertificationGenerationRequest request = CertificationGenerationRequest.builder()
                .completionDate(new Date())
                .courseName(courseName)
                .regenerate(regenerate)
                .build();
        return instituteCertificateManager
                .generateAutomatedCourseCompletionCertificate(user, userId, packageSessionId, instituteId, request)
                .getBody();
    }

    /** Re-send the certificate email for an already-issued certificate. */
    public void resend(String instituteId, String certificateId) {
        IssuedCertificate certificate = issuedCertificateRepository.findById(certificateId)
                .filter(c -> instituteId.equals(c.getInstituteId()))
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Certificate not found"));

        Institute institute = loadInstitute(instituteId);
        String studentName = resolveStudentName(certificate.getUserId());
        String url = StringUtils.hasText(certificate.getFileId())
                ? mediaService.getFilePublicUrlById(certificate.getFileId())
                : null;

        notificationService.notifyCertificateIssued(
                institute,
                certificate.getUserId(),
                studentName,
                certificate.getCourseName(),
                // The certificate number, not the media file id. The issuance path
                // passes the file id here, so the emailed {{CERTIFICATE_ID}} does
                // not match the number printed on the PDF.
                certificate.getCertificateId(),
                url);
    }

    // ----------------------------------------------------------------- helpers

    private int resolveThreshold(String instituteId, String packageId) {
        Institute institute = loadInstitute(instituteId);
        return certificateSettingsResolver
                .resolve(institute, packageId, CertificateTypeEnum.COURSE_COMPLETION.name())
                .getThresholdPercent();
    }

    private Institute loadInstitute(String instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Institute not found"));
    }

    private String resolveStudentName(String userId) {
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
            if (users != null && !users.isEmpty()) {
                return Optional.ofNullable(users.get(0).getFullName()).orElse("");
            }
        } catch (Exception e) {
            log.warn("Could not resolve learner name for {}", userId, e);
        }
        return "";
    }

    /** Page envelope matching the shape the admin tables already consume. */
    public record LearnerPage(List<CourseCertificateLearnerDto> content,
                              int pageNo,
                              int pageSize,
                              long totalElements,
                              int totalPages,
                              boolean last) {
    }
}
