package vacademy.io.admin_core_service.features.translation.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.translation.dto.TranslationBatchUpsertRequestDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationItemStateUpdateDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationItemsResponseDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationReviewItemDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationReviewItemProjection;
import vacademy.io.admin_core_service.features.translation.dto.TranslationStateCountProjection;
import vacademy.io.admin_core_service.features.translation.dto.TranslationStatusResponseDTO;
import vacademy.io.admin_core_service.features.translation.dto.TranslationUpsertItemDTO;
import vacademy.io.admin_core_service.features.translation.entity.ContentTranslationCoverage;
import vacademy.io.admin_core_service.features.translation.entity.EntityFieldTranslation;
import vacademy.io.admin_core_service.features.translation.entity.MediaLanguageVariant;
import vacademy.io.admin_core_service.features.translation.entity.RichTextTranslation;
import vacademy.io.admin_core_service.features.translation.enums.TranslationState;
import vacademy.io.admin_core_service.features.translation.enums.TranslationTargetType;
import vacademy.io.admin_core_service.features.translation.repository.ContentTranslationCoverageRepository;
import vacademy.io.admin_core_service.features.translation.repository.EntityFieldTranslationRepository;
import vacademy.io.admin_core_service.features.translation.repository.MediaLanguageVariantRepository;
import vacademy.io.admin_core_service.features.translation.repository.RichTextTranslationRepository;
import vacademy.io.common.core.i18n.LocaleRegistry;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Content translation sidecars (i18n Phase 1 Wave 1). Translations live in
 * sidecar tables keyed to canonical content ids and are merged into learner
 * payloads via COALESCE LEFT JOINs — the canonical content is never modified,
 * so locales without translations behave exactly as before.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentTranslationService {

    private final RichTextTranslationRepository richTextTranslationRepository;
    private final EntityFieldTranslationRepository entityFieldTranslationRepository;
    private final MediaLanguageVariantRepository mediaLanguageVariantRepository;
    private final ContentTranslationCoverageRepository coverageRepository;

    /**
     * Idempotent batch upsert (internal contract shared with ai_service).
     * Upsert keys: (rich_text_id, locale) / (entity_type, entity_id, field,
     * locale) / (owner_type, owner_id, locale, kind). When the request carries a
     * package_session_id, the coverage counter for each touched locale is
     * adjusted by the net number of rows entering/leaving the learner-visible
     * states (PUBLISHED/STALE).
     */
    @Transactional
    public int batchUpsert(TranslationBatchUpsertRequestDTO request) {
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            return 0;
        }
        Map<String, Integer> visibleDeltaByLocale = new HashMap<>();
        int upserted = 0;
        for (TranslationUpsertItemDTO item : request.getItems()) {
            TranslationTargetType targetType = TranslationTargetType.fromString(
                    item.getTargetType() == null ? "" : item.getTargetType());
            if (targetType == null) {
                throw new VacademyException("Invalid target_type: " + item.getTargetType());
            }
            String locale = validateLocale(item.getLocale());
            TranslationState state = validateBatchState(item.getState());

            boolean wasVisible;
            boolean isVisible = state.isLearnerVisible();
            switch (targetType) {
                case RICH_TEXT -> wasVisible = upsertRichText(item, locale, state);
                case ENTITY_FIELD -> wasVisible = upsertEntityField(item, locale, state);
                case MEDIA -> wasVisible = upsertMedia(item, locale, state);
                default -> throw new VacademyException("Unsupported target_type: " + targetType);
            }
            upserted++;
            int delta = (isVisible ? 1 : 0) - (wasVisible ? 1 : 0);
            if (delta != 0) {
                visibleDeltaByLocale.merge(locale, delta, Integer::sum);
            }
        }
        if (StringUtils.hasText(request.getPackageSessionId())) {
            visibleDeltaByLocale.forEach((locale, delta) ->
                    applyCoverageDelta(request.getPackageSessionId(), locale, delta));
        }
        return upserted;
    }

    /** @return whether the pre-existing row (if any) was learner-visible. */
    private boolean upsertRichText(TranslationUpsertItemDTO item, String locale, TranslationState state) {
        if (!StringUtils.hasText(item.getRichTextId())) {
            throw new VacademyException("rich_text_id is required for RICH_TEXT items");
        }
        if (!StringUtils.hasText(item.getContent())) {
            throw new VacademyException("content is required for RICH_TEXT items");
        }
        RichTextTranslation row = richTextTranslationRepository
                .findByRichTextIdAndLocale(item.getRichTextId(), locale)
                .orElse(null);
        boolean wasVisible = row != null && isVisibleState(row.getState());
        if (row == null) {
            row = new RichTextTranslation();
            row.setRichTextId(item.getRichTextId());
            row.setLocale(locale);
        }
        row.setContent(item.getContent());
        row.setState(state.name());
        applySourceMetadata(item, row::setSourceLocale, row::setSourceHash, row::setTranslatedBy);
        richTextTranslationRepository.save(row);
        return wasVisible;
    }

    /** @return whether the pre-existing row (if any) was learner-visible. */
    private boolean upsertEntityField(TranslationUpsertItemDTO item, String locale, TranslationState state) {
        if (!StringUtils.hasText(item.getEntityType()) || !StringUtils.hasText(item.getEntityId())
                || !StringUtils.hasText(item.getField())) {
            throw new VacademyException("entity_type, entity_id and field are required for ENTITY_FIELD items");
        }
        EntityFieldTranslation row = entityFieldTranslationRepository
                .findByEntityTypeAndEntityIdAndFieldAndLocale(
                        item.getEntityType(), item.getEntityId(), item.getField(), locale)
                .orElse(null);
        boolean wasVisible = row != null && isVisibleState(row.getState());
        if (row == null) {
            row = new EntityFieldTranslation();
            row.setEntityType(item.getEntityType());
            row.setEntityId(item.getEntityId());
            row.setField(item.getField());
            row.setLocale(locale);
        }
        row.setContent(item.getContent());
        row.setJsonValue(item.getJsonValue() == null || item.getJsonValue().isNull()
                ? null : item.getJsonValue().toString());
        row.setState(state.name());
        applySourceMetadata(item, row::setSourceLocale, row::setSourceHash, row::setTranslatedBy);
        entityFieldTranslationRepository.save(row);
        return wasVisible;
    }

    /** @return whether the pre-existing row (if any) was learner-visible. */
    private boolean upsertMedia(TranslationUpsertItemDTO item, String locale, TranslationState state) {
        if (!StringUtils.hasText(item.getEntityType()) || !StringUtils.hasText(item.getEntityId())) {
            throw new VacademyException("entity_type and entity_id are required for MEDIA items");
        }
        if (!StringUtils.hasText(item.getFileIdOrUrl())) {
            throw new VacademyException("file_id_or_url is required for MEDIA items");
        }
        String kind = StringUtils.hasText(item.getKind()) ? item.getKind() : MediaLanguageVariant.KIND_PRIMARY;
        MediaLanguageVariant row = mediaLanguageVariantRepository
                .findByOwnerTypeAndOwnerIdAndLocaleAndKind(item.getEntityType(), item.getEntityId(), locale, kind)
                .orElse(null);
        boolean wasVisible = row != null && isVisibleState(row.getState());
        if (row == null) {
            row = new MediaLanguageVariant();
            row.setOwnerType(item.getEntityType());
            row.setOwnerId(item.getEntityId());
            row.setLocale(locale);
            row.setKind(kind);
        }
        row.setFileIdOrUrl(item.getFileIdOrUrl());
        row.setState(state.name());
        mediaLanguageVariantRepository.save(row);
        return wasVisible;
    }

    private void applySourceMetadata(TranslationUpsertItemDTO item,
                                     java.util.function.Consumer<String> sourceLocaleSetter,
                                     java.util.function.Consumer<String> sourceHashSetter,
                                     java.util.function.Consumer<String> translatedBySetter) {
        sourceLocaleSetter.accept(StringUtils.hasText(item.getSourceLocale())
                ? LocaleRegistry.normalize(item.getSourceLocale())
                : LocaleRegistry.DEFAULT);
        sourceHashSetter.accept(item.getSourceHash());
        translatedBySetter.accept(item.getTranslatedBy());
    }

    /** Counts by state for one (packageSession, locale) + the coverage counter. */
    @Transactional(readOnly = true)
    public TranslationStatusResponseDTO getStatus(String packageSessionId, String locale) {
        if (!StringUtils.hasText(packageSessionId)) {
            throw new VacademyException("Please provide packageSessionId");
        }
        String normalizedLocale = validateLocale(locale);
        Map<String, Long> countsByState = new LinkedHashMap<>();
        for (TranslationState state : TranslationState.values()) {
            countsByState.put(state.name(), 0L);
        }
        mergeCounts(countsByState,
                richTextTranslationRepository.countByStateForPackageSession(packageSessionId, normalizedLocale));
        mergeCounts(countsByState,
                entityFieldTranslationRepository.countByStateForPackageSession(packageSessionId, normalizedLocale));
        int coveragePublished = coverageRepository.findByPackageSessionIdAndLocale(packageSessionId, normalizedLocale)
                .map(c -> c.getPublishedCount() == null ? 0 : c.getPublishedCount())
                .orElse(0);
        return new TranslationStatusResponseDTO(packageSessionId, normalizedLocale, countsByState, coveragePublished);
    }

    private void mergeCounts(Map<String, Long> target, List<TranslationStateCountProjection> rows) {
        if (rows == null) {
            return;
        }
        for (TranslationStateCountProjection row : rows) {
            if (row.getState() != null) {
                target.merge(row.getState(), row.getCnt() == null ? 0L : row.getCnt(), Long::sum);
            }
        }
    }

    /**
     * Paged review-items listing for the admin Translation review screen: every
     * sidecar row (both text tables) reachable from the package session's
     * content graph, with base content joined where cheap. Optional state
     * filter; page/size are clamped to sane bounds. READ-ONLY.
     */
    @Transactional(readOnly = true)
    public TranslationItemsResponseDTO getReviewItems(
            String packageSessionId, String locale, String state, int page, int size) {
        if (!StringUtils.hasText(packageSessionId)) {
            throw new VacademyException("Please provide packageSessionId");
        }
        String normalizedLocale = validateLocale(locale);
        String stateFilter = "";
        if (StringUtils.hasText(state)) {
            TranslationState parsed = TranslationState.fromString(state);
            if (parsed == null) {
                throw new VacademyException("Invalid state: " + state);
            }
            stateFilter = parsed.name();
        }
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 100);

        long total = richTextTranslationRepository.countReviewItemsForPackageSession(
                packageSessionId, normalizedLocale, stateFilter);
        List<TranslationReviewItemProjection> rows = richTextTranslationRepository
                .findReviewItemsForPackageSession(
                        packageSessionId, normalizedLocale, stateFilter,
                        safeSize, (long) safePage * safeSize);

        List<TranslationReviewItemDTO> items = rows.stream().map(this::toReviewItemDTO).toList();
        int totalPages = (int) ((total + safeSize - 1) / safeSize);
        return new TranslationItemsResponseDTO(
                packageSessionId, normalizedLocale,
                StringUtils.hasText(stateFilter) ? stateFilter : null,
                safePage, safeSize, total, totalPages, items);
    }

    private TranslationReviewItemDTO toReviewItemDTO(TranslationReviewItemProjection row) {
        Map<String, String> entityRef = new LinkedHashMap<>();
        if (TranslationTargetType.RICH_TEXT.name().equals(row.getItemTable())) {
            entityRef.put("rich_text_id", row.getRichTextId());
        } else {
            entityRef.put("entity_type", row.getEntityType());
            entityRef.put("entity_id", row.getEntityId());
            entityRef.put("field", row.getField());
        }
        return new TranslationReviewItemDTO(
                row.getItemTable(), row.getId(), row.getState(),
                row.getTranslatedContent(), row.getBaseContent(),
                entityRef, row.getTranslatedBy(), row.getUpdatedAt());
    }

    /**
     * Review approve/reject: validates the state transition (see
     * {@link TranslationState#canTransitionTo}) and stamps reviewed_by with the
     * acting user. When package_session_id is supplied, the coverage counter is
     * adjusted for rows entering/leaving the learner-visible states.
     */
    @Transactional
    public void updateItemState(TranslationItemStateUpdateDTO request, String reviewerUserId) {
        if (request == null || !StringUtils.hasText(request.getId())) {
            throw new VacademyException("Please provide the translation item id");
        }
        TranslationTargetType table = TranslationTargetType.fromString(
                request.getTable() == null ? "" : request.getTable());
        if (table == null) {
            throw new VacademyException("Invalid table: " + request.getTable());
        }
        TranslationState newState = TranslationState.fromString(request.getState() == null ? "" : request.getState());
        if (newState == null) {
            throw new VacademyException("Invalid state: " + request.getState());
        }
        String locale;
        boolean wasVisible;
        switch (table) {
            case RICH_TEXT -> {
                RichTextTranslation row = richTextTranslationRepository.findById(request.getId())
                        .orElseThrow(() -> new VacademyException("Translation not found: " + request.getId()));
                validateTransition(row.getState(), newState);
                wasVisible = isVisibleState(row.getState());
                locale = row.getLocale();
                row.setState(newState.name());
                row.setReviewedBy(reviewerUserId);
                richTextTranslationRepository.save(row);
            }
            case ENTITY_FIELD -> {
                EntityFieldTranslation row = entityFieldTranslationRepository.findById(request.getId())
                        .orElseThrow(() -> new VacademyException("Translation not found: " + request.getId()));
                validateTransition(row.getState(), newState);
                wasVisible = isVisibleState(row.getState());
                locale = row.getLocale();
                row.setState(newState.name());
                row.setReviewedBy(reviewerUserId);
                entityFieldTranslationRepository.save(row);
            }
            case MEDIA -> {
                MediaLanguageVariant row = mediaLanguageVariantRepository.findById(request.getId())
                        .orElseThrow(() -> new VacademyException("Media variant not found: " + request.getId()));
                validateTransition(row.getState(), newState);
                wasVisible = isVisibleState(row.getState());
                locale = row.getLocale();
                row.setState(newState.name());
                mediaLanguageVariantRepository.save(row);
            }
            default -> throw new VacademyException("Unsupported table: " + table);
        }
        int delta = (newState.isLearnerVisible() ? 1 : 0) - (wasVisible ? 1 : 0);
        if (delta != 0 && StringUtils.hasText(request.getPackageSessionId())) {
            applyCoverageDelta(request.getPackageSessionId(), locale, delta);
        }
    }

    private void validateTransition(String currentState, TranslationState newState) {
        TranslationState current = TranslationState.fromString(currentState == null ? "" : currentState);
        if (current == null) {
            throw new VacademyException("Item has an unknown current state: " + currentState);
        }
        if (!current.canTransitionTo(newState)) {
            throw new VacademyException(
                    "Invalid state transition: " + current.name() + " -> " + newState.name());
        }
    }

    /** Locales a learner can pick for the package session (published_count > 0). */
    @Transactional(readOnly = true)
    public List<String> getAvailableLanguages(String packageSessionId) {
        if (!StringUtils.hasText(packageSessionId)) {
            return List.of();
        }
        return coverageRepository.findAvailableLocales(packageSessionId);
    }

    private void applyCoverageDelta(String packageSessionId, String locale, int delta) {
        ContentTranslationCoverage coverage = coverageRepository
                .findByPackageSessionIdAndLocale(packageSessionId, locale)
                .orElseGet(() -> {
                    ContentTranslationCoverage fresh = new ContentTranslationCoverage();
                    fresh.setPackageSessionId(packageSessionId);
                    fresh.setLocale(locale);
                    fresh.setPublishedCount(0);
                    return fresh;
                });
        int current = coverage.getPublishedCount() == null ? 0 : coverage.getPublishedCount();
        coverage.setPublishedCount(Math.max(0, current + delta));
        coverageRepository.save(coverage);
    }

    private boolean isVisibleState(String state) {
        TranslationState parsed = TranslationState.fromString(state == null ? "" : state);
        return parsed != null && parsed.isLearnerVisible();
    }

    private String validateLocale(String locale) {
        if (!LocaleRegistry.isSupported(locale)) {
            throw new VacademyException("Unsupported locale: " + locale);
        }
        return LocaleRegistry.normalize(locale);
    }

    private TranslationState validateBatchState(String state) {
        TranslationState parsed = TranslationState.fromString(state == null ? "" : state);
        if (parsed != TranslationState.DRAFT && parsed != TranslationState.PUBLISHED) {
            throw new VacademyException("Batch upsert state must be DRAFT or PUBLISHED, got: " + state);
        }
        return parsed;
    }
}
