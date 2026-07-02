package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AchievementItem;

import java.util.ArrayList;
import java.util.List;

/**
 * Collects issued certificates for a student and maps them to {@link AchievementItem}.
 * Certificate achievements have type="CERTIFICATE".
 * Streak badges (type="BADGE") are added by the aggregator after ActivityCollector runs.
 * Falls back to an empty list on error.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CertificateCollector {

    private final IssuedCertificateRepository certificateRepository;

    public List<AchievementItem> collect(String userId) {
        try {
            IssuedCertificate probe = IssuedCertificate.builder().userId(userId).build();
            List<IssuedCertificate> certs = certificateRepository.findAll(Example.of(probe));

            List<AchievementItem> result = new ArrayList<>();
            for (IssuedCertificate c : certs) {
                String courseName = c.getCourseName();
                String title = (courseName != null && !courseName.isBlank())
                        ? courseName + " — Certificate of Completion"
                        : "Certificate of Completion";

                result.add(AchievementItem.builder()
                        .title(title)
                        .issuedAt(c.getIssuedAt() != null ? c.getIssuedAt().toString() : null)
                        .courseName(courseName)
                        .completionPercentage(c.getCompletionPercentage())
                        .type("CERTIFICATE")
                        .build());
            }
            return result;

        } catch (Exception e) {
            log.error("[CertificateCollector] Failed for userId={}: {}", userId, e.getMessage());
            return List.of();
        }
    }
}
