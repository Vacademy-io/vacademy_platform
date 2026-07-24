package vacademy.io.admin_core_service.features.translation.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.translation.dto.TranslationBatchUpsertRequestDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationBatchUpsertResponseDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationStatusResponseDTO;
import vacademy.io.admin_core_service.features.translation.service.ContentTranslationService;

/**
 * Internal (service-to-service) translation sidecar API — the ONLY write path
 * ai_service has into Java-owned translation tables (it never writes them
 * directly). Guarded by {@code InternalAuthFilter} (HMAC clientName/Signature
 * headers) via the {@code /admin-core-service/internal/**} matcher — never
 * exposed to browsers.
 */
@RestController
@RequestMapping("/admin-core-service/internal/translations/v1")
@RequiredArgsConstructor
@Slf4j
public class InternalTranslationController {

    private final ContentTranslationService contentTranslationService;

    /**
     * Idempotent batch upsert per the shared snake_case contract. Returns
     * {"upserted": n}. Upsert keys: (rich_text_id, locale) /
     * (entity_type, entity_id, field, locale) / (owner_type, owner_id, locale, kind).
     */
    @PostMapping("/batch-upsert")
    public ResponseEntity<TranslationBatchUpsertResponseDTO> batchUpsert(
            @RequestBody TranslationBatchUpsertRequestDTO request) {
        int upserted = contentTranslationService.batchUpsert(request);
        log.info("Translation batch-upsert: {} items upserted (packageSessionId={})",
                upserted, request != null ? request.getPackageSessionId() : null);
        return ResponseEntity.ok(new TranslationBatchUpsertResponseDTO(upserted));
    }

    /** Counts by state for one (packageSession, locale) + the coverage counter. */
    @GetMapping("/status")
    public ResponseEntity<TranslationStatusResponseDTO> getStatus(
            @RequestParam("packageSessionId") String packageSessionId,
            @RequestParam("locale") String locale) {
        return ResponseEntity.ok(contentTranslationService.getStatus(packageSessionId, locale));
    }
}
