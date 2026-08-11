package vacademy.io.admin_core_service.features.certificate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.certificate.dto.LearnerCertificateConfigDto;
import vacademy.io.admin_core_service.features.certificate.dto.ResolvedCertificateConfig;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Optional;

/**
 * Resolves the certificate config a learner client needs for one batch.
 *
 * <p>A batch belongs to a course, and course settings can override the institute
 * default, so the batch id has to be walked up to its package before resolving.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerCertificateConfigService {

    private final CertificateSettingsResolver certificateSettingsResolver;
    private final InstituteRepository instituteRepository;
    private final PackageSessionRepository packageSessionRepository;

    public LearnerCertificateConfigDto resolveForBatch(String instituteId, String packageSessionId) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty()) {
            // Unknown institute: report disabled rather than 404. The client uses
            // this purely to decide whether to attempt issuance, and the issue
            // endpoint enforces the real gate regardless.
            return LearnerCertificateConfigDto.builder()
                    .enabled(false)
                    .thresholdPercent(CertificateSettingsResolver.DEFAULT_THRESHOLD_PERCENT)
                    .build();
        }

        String packageId = resolvePackageId(packageSessionId);
        ResolvedCertificateConfig config = certificateSettingsResolver.resolve(
                institute.get(), packageId, CertificateTypeEnum.COURSE_COMPLETION.name());

        return LearnerCertificateConfigDto.builder()
                .enabled(config.isEnabled())
                .thresholdPercent(config.getThresholdPercent())
                .build();
    }

    private String resolvePackageId(String packageSessionId) {
        try {
            return packageSessionRepository.findById(packageSessionId)
                    .map(PackageSession::getPackageEntity)
                    .map(PackageEntity::getId)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Could not resolve course for batch {}; falling back to institute defaults",
                    packageSessionId, e);
            return null;
        }
    }
}
