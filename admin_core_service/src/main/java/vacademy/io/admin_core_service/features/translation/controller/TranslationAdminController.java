package vacademy.io.admin_core_service.features.translation.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.translation.dto.TranslationItemStateUpdateDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationItemsResponseDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationStatusResponseDTO;
import vacademy.io.admin_core_service.features.translation.service.ContentTranslationService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Map;

/**
 * Admin-facing translation review API (standard JWT controller auth, same as
 * other admin routes): translation status per (packageSession, locale) and
 * review approve/reject state changes.
 */
@RestController
@RequestMapping("/admin-core-service/translations/v1")
@RequiredArgsConstructor
public class TranslationAdminController {

    private final ContentTranslationService contentTranslationService;

    /** Same payload as the internal status route. */
    @GetMapping("/status")
    public ResponseEntity<TranslationStatusResponseDTO> getStatus(
            @RequestParam("packageSessionId") String packageSessionId,
            @RequestParam("locale") String locale,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(contentTranslationService.getStatus(packageSessionId, locale));
    }

    /**
     * Paged review-items listing for the Translation review screen. Optional
     * state filter (DRAFT|IN_REVIEW|PUBLISHED|STALE); page is 0-based.
     */
    @GetMapping("/items")
    public ResponseEntity<TranslationItemsResponseDTO> getItems(
            @RequestParam("packageSessionId") String packageSessionId,
            @RequestParam("locale") String locale,
            @RequestParam(value = "state", required = false) String state,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(
                contentTranslationService.getReviewItems(packageSessionId, locale, state, page, size));
    }

    /**
     * Review approve/reject: {"table": RICH_TEXT|ENTITY_FIELD|MEDIA, "id", "state"}.
     * Valid transitions: DRAFT -> IN_REVIEW|PUBLISHED, IN_REVIEW -> DRAFT|PUBLISHED,
     * PUBLISHED -> any, STALE -> any. reviewed_by is stamped from the caller.
     */
    @PutMapping("/item/state")
    public ResponseEntity<Map<String, String>> updateItemState(
            @RequestBody TranslationItemStateUpdateDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        String reviewerUserId = org.springframework.util.StringUtils.hasText(user.getUserId())
                ? user.getUserId()
                : user.getId();
        contentTranslationService.updateItemState(request, reviewerUserId);
        return ResponseEntity.ok(Map.of("status", "updated"));
    }
}
