package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.AchievementItem;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
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

    /**
     * @param startDate report window start — certificates issued before it are excluded
     * @param endDate   report window end — certificates issued after it are excluded
     *
     * <p>The window is applied here because this is a period report: previously every certificate
     * the learner had <em>ever</em> earned was listed under a 30-day window, overstating what they
     * achieved in it. Certificates with no issue date are kept (we can't prove they're out of range).
     */
    public List<AchievementItem> collect(String userId, LocalDate startDate, LocalDate endDate) {
        try {
            IssuedCertificate probe = IssuedCertificate.builder().userId(userId).build();
            List<IssuedCertificate> certs = certificateRepository.findAll(Example.of(probe));

            List<AchievementItem> result = new ArrayList<>();
            for (IssuedCertificate c : certs) {
                if (!isWithinWindow(c.getIssuedAt(), startDate, endDate)) continue;
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

    /** Inclusive on both ends; a null issue date is kept (unprovable, so not excluded). */
    private boolean isWithinWindow(Date issuedAt, LocalDate startDate, LocalDate endDate) {
        if (issuedAt == null || startDate == null || endDate == null) return true;
        try {
            LocalDate issued = issuedAt.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            return !issued.isBefore(startDate) && !issued.isAfter(endDate);
        } catch (Exception e) {
            return true;
        }
    }
}
