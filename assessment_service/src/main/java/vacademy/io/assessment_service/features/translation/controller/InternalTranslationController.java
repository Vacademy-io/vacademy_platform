package vacademy.io.assessment_service.features.translation.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.translation.dto.TranslationBatchUpsertRequest;
import vacademy.io.assessment_service.features.translation.dto.TranslationStatusResponse;
import vacademy.io.assessment_service.features.translation.service.TranslationService;

import java.util.Map;

/**
 * Internal (service-to-service) translation endpoints — the assessment side of
 * the shared batch-upsert contract. ai_service never writes these tables
 * directly; it POSTs translated strings here.
 *
 * <p><b>Security:</b> mapped under {@code /assessment-service/internal/**},
 * which is guarded by {@code InternalAuthFilter} (common_service) — requests
 * must carry {@code clientName} + {@code Signature} HMAC headers validated
 * against the client_secret_key table. No JWT required. This is the same
 * scheme ai_service already uses to call
 * {@code /internal/evaluation-tool/metadata} for AI assessment generation /
 * evaluation (its internal_auth resolver sends CLIENT_NAME/CLIENT_SECRET, or
 * reuses the shared admin_core_service identity). Same pattern as
 * {@code InternalAssessmentRegistrationController}.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/assessment-service/internal/translations/v1")
public class InternalTranslationController {

    private final TranslationService translationService;

    /**
     * Shared contract: {@code {"items":[...], "package_session_id": ...}} plus
     * an assessment_service extension — optional {@code assessment_id} keying
     * the coverage rollup recompute. Returns {@code {"upserted": <n>}} where n
     * counts rows actually written (invalid / MEDIA items are skipped).
     */
    @PostMapping("/batch-upsert")
    public ResponseEntity<Map<String, Integer>> batchUpsert(@RequestBody TranslationBatchUpsertRequest request) {
        int upserted = translationService.batchUpsert(request);
        return ResponseEntity.ok(Map.of("upserted", upserted));
    }

    /** Translation coverage of one assessment in one locale (live counts). */
    @GetMapping("/status")
    public ResponseEntity<TranslationStatusResponse> status(@RequestParam("assessmentId") String assessmentId,
            @RequestParam("locale") String locale) {
        return ResponseEntity.ok(translationService.getStatus(assessmentId, locale));
    }
}
