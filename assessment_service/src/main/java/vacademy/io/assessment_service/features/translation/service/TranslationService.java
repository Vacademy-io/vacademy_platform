package vacademy.io.assessment_service.features.translation.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.SectionDto;
import vacademy.io.assessment_service.features.question_core.dto.OptionDTO;
import vacademy.io.assessment_service.features.question_core.dto.OptionWithoutExplanationDTO;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.translation.dto.TranslationBatchUpsertRequest;
import vacademy.io.assessment_service.features.translation.dto.TranslationStatusResponse;
import vacademy.io.assessment_service.features.translation.entity.AssessmentTranslationCoverage;
import vacademy.io.assessment_service.features.translation.entity.EntityFieldTranslation;
import vacademy.io.assessment_service.features.translation.entity.RichTextTranslation;
import vacademy.io.assessment_service.features.translation.enums.TranslationState;
import vacademy.io.assessment_service.features.translation.repository.AssessmentTranslationCoverageRepository;
import vacademy.io.assessment_service.features.translation.repository.EntityFieldTranslationRepository;
import vacademy.io.assessment_service.features.translation.repository.RichTextTranslationRepository;
import vacademy.io.common.core.i18n.LocaleRegistry;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sidecar content translations (i18n Phase 1, Arabic-first).
 *
 * <p>Delivery model: canonical rows are NEVER copied or mutated. When the
 * request locale is not "en", servable (PUBLISHED/STALE) translation rows are
 * fetched in ONE query and their content is swapped into the response DTOs;
 * every item without a translation keeps its canonical content (per-item
 * fallback). Requesting "en" — or any locale with zero translation rows —
 * yields byte-identical behavior to before this feature existed.
 */
@Slf4j
@Service
public class TranslationService {

    @Autowired
    private RichTextTranslationRepository richTextTranslationRepository;

    @Autowired
    private EntityFieldTranslationRepository entityFieldTranslationRepository;

    @Autowired
    private AssessmentTranslationCoverageRepository coverageRepository;

    /**
     * The request's content locale as a supported BCP-47 primary subtag.
     * LocaleResolutionFilter (common_service) has already resolved
     * ?lang > Accept-Language > JWT claim > "en" into LocaleContextHolder for
     * every request; anything unexpected normalizes to "en".
     */
    public String resolveRequestLocale() {
        try {
            return LocaleRegistry.normalize(LocaleContextHolder.getLocale().toLanguageTag());
        } catch (Exception e) {
            return LocaleRegistry.DEFAULT;
        }
    }

    /**
     * Swap servable translations into the assessment-start preview DTOs, in
     * place. No-op for "en". Never throws — a translation problem must never
     * break assessment start, so any failure leaves the DTOs untouched.
     */
    public void localizeSectionDtos(List<SectionDto> sectionDtos) {
        try {
            String locale = resolveRequestLocale();
            if (LocaleRegistry.DEFAULT.equals(locale) || sectionDtos == null || sectionDtos.isEmpty()) {
                return;
            }

            // 1. Collect every rich-text id the payload references, in one pass.
            Set<AssessmentRichTextDataDTO> richTexts = collectRichTexts(sectionDtos);
            List<String> ids = new ArrayList<>(new LinkedHashSet<>(
                    richTexts.stream().map(AssessmentRichTextDataDTO::getId).filter(StringUtils::hasText).toList()));
            if (ids.isEmpty()) {
                return;
            }

            // 2. ONE query for all servable rows in this locale.
            List<RichTextTranslation> rows = richTextTranslationRepository
                    .findByRichTextIdInAndLocaleAndStateIn(ids, locale, TranslationState.SERVABLE);
            if (rows.isEmpty()) {
                return;
            }
            Map<String, String> translatedContentById = new HashMap<>();
            for (RichTextTranslation row : rows) {
                translatedContentById.put(row.getRichTextId(), row.getContent());
            }

            // 3. Per-item swap; items without a translation keep canonical content.
            for (AssessmentRichTextDataDTO richText : richTexts) {
                String translated = translatedContentById.get(richText.getId());
                if (translated != null) {
                    richText.setContent(translated);
                }
            }
        } catch (Exception e) {
            log.warn("[i18n] preview localization skipped due to error: {}", e.getMessage());
        }
    }

    /**
     * Every rich-text DTO reachable from the preview payload: section
     * descriptions, question text, comprehension passages (parent rich text)
     * and option text (both option DTO shapes, defensively).
     */
    private Set<AssessmentRichTextDataDTO> collectRichTexts(List<SectionDto> sectionDtos) {
        Set<AssessmentRichTextDataDTO> richTexts = new HashSet<>();
        for (SectionDto section : sectionDtos) {
            if (section == null) continue;
            addIfPresent(richTexts, section.getDescription());
            if (section.getQuestionPreviewDtoList() == null) continue;
            for (AssessmentQuestionPreviewDto question : section.getQuestionPreviewDtoList()) {
                if (question == null) continue;
                addIfPresent(richTexts, question.getQuestion());
                addIfPresent(richTexts, question.getParentRichText());
                if (question.getOptions() != null) {
                    for (OptionWithoutExplanationDTO option : question.getOptions()) {
                        if (option != null) addIfPresent(richTexts, option.getText());
                    }
                }
                if (question.getOptionsWithExplanation() != null) {
                    for (OptionDTO option : question.getOptionsWithExplanation()) {
                        if (option == null) continue;
                        addIfPresent(richTexts, option.getText());
                        addIfPresent(richTexts, option.getExplanationText());
                    }
                }
            }
        }
        return richTexts;
    }

    private void addIfPresent(Set<AssessmentRichTextDataDTO> collector, AssessmentRichTextDataDTO richText) {
        if (richText != null && StringUtils.hasText(richText.getId())) {
            collector.add(richText);
        }
    }

    /**
     * Internal batch-upsert (shared contract with ai_service). Items are
     * processed independently: invalid or unsupported items are skipped with a
     * warning and NOT counted, so the returned count is honest. MEDIA targets
     * have no sidecar table in assessment_service (assessments carry no
     * translatable media yet) and are skipped.
     *
     * @return number of rows actually inserted or updated
     */
    @Transactional
    public int batchUpsert(TranslationBatchUpsertRequest request) {
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            return 0;
        }
        int upserted = 0;
        Set<String> localesTouched = new LinkedHashSet<>();
        for (TranslationBatchUpsertRequest.Item item : request.getItems()) {
            if (item == null) continue;
            String locale = normalizeItemLocale(item.getLocale());
            if (locale == null) {
                log.warn("[i18n] batch-upsert skipping item with unsupported locale '{}'", item.getLocale());
                continue;
            }
            String targetType = item.getTargetType() == null ? "" : item.getTargetType().trim().toUpperCase();
            boolean applied = switch (targetType) {
                case "RICH_TEXT" -> upsertRichText(item, locale);
                case "ENTITY_FIELD" -> upsertEntityField(item, locale);
                case "MEDIA" -> {
                    log.warn("[i18n] batch-upsert skipping MEDIA item — no media sidecar in assessment_service");
                    yield false;
                }
                default -> {
                    log.warn("[i18n] batch-upsert skipping item with unknown target_type '{}'", item.getTargetType());
                    yield false;
                }
            };
            if (applied) {
                upserted++;
                localesTouched.add(locale);
            }
        }

        // Coverage rollup is keyed by assessment_id; recompute when provided.
        if (StringUtils.hasText(request.getAssessmentId())) {
            for (String locale : localesTouched) {
                refreshCoverage(request.getAssessmentId(), locale);
            }
        }
        return upserted;
    }

    /** Coverage of one assessment in one locale (live counts; read-only). */
    public TranslationStatusResponse getStatus(String assessmentId, String locale) {
        String normalizedLocale = LocaleRegistry.normalize(locale);
        long publishedCount = richTextTranslationRepository.countPublishedForAssessment(assessmentId,
                normalizedLocale);
        long totalCount = richTextTranslationRepository.countTranslatableForAssessment(assessmentId);
        Date updatedAt = coverageRepository.findByAssessmentIdAndLocale(assessmentId, normalizedLocale)
                .map(AssessmentTranslationCoverage::getUpdatedAt).orElse(null);
        return TranslationStatusResponse.builder()
                .assessmentId(assessmentId)
                .locale(normalizedLocale)
                .publishedCount(publishedCount)
                .totalCount(totalCount)
                .updatedAt(updatedAt)
                .build();
    }

    private boolean upsertRichText(TranslationBatchUpsertRequest.Item item, String locale) {
        if (!StringUtils.hasText(item.getRichTextId()) || !StringUtils.hasText(item.getContent())) {
            log.warn("[i18n] batch-upsert skipping RICH_TEXT item without rich_text_id/content");
            return false;
        }
        RichTextTranslation row = richTextTranslationRepository
                .findByRichTextIdAndLocale(item.getRichTextId(), locale)
                .orElseGet(() -> RichTextTranslation.builder()
                        .richTextId(item.getRichTextId())
                        .locale(locale)
                        .build());
        row.setContent(item.getContent());
        row.setState(normalizeState(item.getState()));
        row.setSourceLocale(StringUtils.hasText(item.getSourceLocale()) ? item.getSourceLocale()
                : LocaleRegistry.DEFAULT);
        row.setSourceHash(item.getSourceHash());
        row.setTranslatedBy(item.getTranslatedBy());
        row.setUpdatedAt(new Date());
        richTextTranslationRepository.save(row);
        return true;
    }

    private boolean upsertEntityField(TranslationBatchUpsertRequest.Item item, String locale) {
        boolean hasJson = item.getJsonValue() != null && !item.getJsonValue().isNull();
        if (!StringUtils.hasText(item.getEntityType()) || !StringUtils.hasText(item.getEntityId())
                || !StringUtils.hasText(item.getField()) || (!StringUtils.hasText(item.getContent()) && !hasJson)) {
            log.warn("[i18n] batch-upsert skipping ENTITY_FIELD item missing entity_type/entity_id/field/content");
            return false;
        }
        EntityFieldTranslation row = entityFieldTranslationRepository
                .findByEntityTypeAndEntityIdAndFieldAndLocale(item.getEntityType(), item.getEntityId(),
                        item.getField(), locale)
                .orElseGet(() -> EntityFieldTranslation.builder()
                        .entityType(item.getEntityType())
                        .entityId(item.getEntityId())
                        .field(item.getField())
                        .locale(locale)
                        .build());
        row.setContent(item.getContent());
        row.setJsonValue(hasJson ? item.getJsonValue().toString() : null);
        row.setState(normalizeState(item.getState()));
        row.setSourceLocale(StringUtils.hasText(item.getSourceLocale()) ? item.getSourceLocale()
                : LocaleRegistry.DEFAULT);
        row.setSourceHash(item.getSourceHash());
        row.setTranslatedBy(item.getTranslatedBy());
        row.setUpdatedAt(new Date());
        entityFieldTranslationRepository.save(row);
        return true;
    }

    private void refreshCoverage(String assessmentId, String locale) {
        long publishedCount = richTextTranslationRepository.countPublishedForAssessment(assessmentId, locale);
        AssessmentTranslationCoverage coverage = coverageRepository.findByAssessmentIdAndLocale(assessmentId, locale)
                .orElseGet(() -> AssessmentTranslationCoverage.builder()
                        .assessmentId(assessmentId)
                        .locale(locale)
                        .build());
        coverage.setPublishedCount((int) publishedCount);
        coverage.setUpdatedAt(new Date());
        coverageRepository.save(coverage);
    }

    /**
     * Translations target non-default locales only; "en" is the canonical
     * content, so an item claiming to be an "en" translation (or an
     * unsupported tag) is rejected — null means skip.
     */
    private String normalizeItemLocale(String locale) {
        if (!LocaleRegistry.isSupported(locale)) {
            return null;
        }
        String normalized = LocaleRegistry.normalize(locale);
        return LocaleRegistry.DEFAULT.equals(normalized) ? null : normalized;
    }

    /** Contract sends DRAFT|PUBLISHED; any other valid state is accepted, garbage becomes DRAFT. */
    private String normalizeState(String state) {
        String candidate = state == null ? null : state.trim().toUpperCase();
        return TranslationState.isValid(candidate) ? candidate : TranslationState.DRAFT.name();
    }
}
