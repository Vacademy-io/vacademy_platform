package vacademy.io.admin_core_service.features.certificate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.certificate.dto.IssuedCertificateDTO;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;

import java.util.List;
import java.util.Optional;

/**
 * Read-only certificate access for the learner and (via the guarded BFF) the
 * parent. This is the only learner-facing read path for {@code issued_certificate};
 * previously certificates were reachable only through the v2 report's collector.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateReadService {

    private final IssuedCertificateRepository issuedCertificateRepository;
    private final MediaService mediaService;

    /** A learner's certificates in one institute, newest first. */
    public List<IssuedCertificateDTO> listForUser(String userId, String instituteId) {
        return issuedCertificateRepository
                .findByUserIdAndInstituteIdOrderByIssuedAtDesc(userId, instituteId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * One certificate, only if it belongs to {@code userId} — the sub-resource
     * ownership check. Empty means "not this user's certificate" (caller should 404).
     */
    public Optional<IssuedCertificateDTO> findOwnedByUser(String certificateId, String userId) {
        return issuedCertificateRepository
                .findByIdAndUserId(certificateId, userId)
                .map(this::toDto);
    }

    private IssuedCertificateDTO toDto(IssuedCertificate c) {
        return IssuedCertificateDTO.builder()
                .certificateId(c.getCertificateId())
                .courseName(c.getCourseName())
                .packageSessionId(c.getPackageSessionId())
                .completionPercentage(c.getCompletionPercentage())
                .issuedAt(c.getIssuedAt())
                .fileId(c.getFileId())
                .fileUrl(resolveFileUrl(c.getFileId()))
                .build();
    }

    private String resolveFileUrl(String fileId) {
        if (fileId == null || fileId.isBlank()) {
            return null;
        }
        if (fileId.startsWith("http://") || fileId.startsWith("https://")) {
            return fileId;
        }
        try {
            String resolved = mediaService.getFilePublicUrlByIdWithoutExpiry(fileId);
            return (resolved != null && !resolved.isBlank()) ? resolved.trim() : null;
        } catch (Exception e) {
            log.warn("Could not resolve certificate fileId={}: {}", fileId, e.getMessage());
            return null;
        }
    }
}
