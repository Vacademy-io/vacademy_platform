package vacademy.io.admin_core_service.features.course_catalogue.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CatalogueRevisionDTOs.RevisionResponse;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CatalogueRevisionDTOs.SaveDraftRequest;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueRevision;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CourseCatalogue;
import vacademy.io.admin_core_service.features.course_catalogue.enums.CatalogueRevisionStatusEnum;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CatalogueRevisionRepository;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CourseCatalogueRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CatalogueRevisionService {

    @Autowired
    private CatalogueRevisionRepository revisionRepository;

    @Autowired
    private CourseCatalogueRepository courseCatalogueRepository;

    /** Latest DRAFT for the catalogue, or empty when none exists. */
    @Transactional(readOnly = true)
    public Optional<RevisionResponse> getDraft(String catalogueId) {
        return revisionRepository
                .findFirstByCatalogueIdAndStatusOrderByRevisionNoDescIdDesc(catalogueId,
                        CatalogueRevisionStatusEnum.DRAFT.name())
                .map(r -> toResponse(r, true));
    }

    /**
     * Upserts the single DRAFT row for a catalogue: updates it in place when
     * present, otherwise creates one with the next revision number.
     */
    @Transactional
    public RevisionResponse saveDraft(String catalogueId, SaveDraftRequest request, String userId) {
        requireCatalogue(catalogueId);

        CatalogueRevision draft = revisionRepository
                .findFirstByCatalogueIdAndStatusOrderByRevisionNoDescIdDesc(catalogueId,
                        CatalogueRevisionStatusEnum.DRAFT.name())
                .orElseGet(() -> CatalogueRevision.builder()
                        .catalogueId(catalogueId)
                        .revisionNo(nextRevisionNo(catalogueId))
                        .status(CatalogueRevisionStatusEnum.DRAFT.name())
                        .createdByUserId(userId)
                        .build());

        draft.setCatalogueJson(request.getCatalogueJson());
        if (request.getSource() != null) draft.setSource(request.getSource());
        if (draft.getSource() == null) draft.setSource("MANUAL");
        if (request.getAiRunId() != null) draft.setAiRunId(request.getAiRunId());
        draft = revisionRepository.save(draft);
        return toResponse(draft, false);
    }

    /**
     * Promotes the current DRAFT to PUBLISHED and copies its JSON into
     * course_catalogue.catalogue_json — the column the learner app reads.
     */
    @Transactional
    public RevisionResponse publish(String catalogueId, String userId) {
        CourseCatalogue catalogue = requireCatalogue(catalogueId);

        CatalogueRevision draft = revisionRepository
                .findFirstByCatalogueIdAndStatusOrderByRevisionNoDescIdDesc(catalogueId,
                        CatalogueRevisionStatusEnum.DRAFT.name())
                .orElseThrow(() -> new VacademyException(HttpStatus.BAD_REQUEST, "No draft to publish"));

        draft.setStatus(CatalogueRevisionStatusEnum.PUBLISHED.name());
        revisionRepository.save(draft);

        catalogue.setCatalogueJson(draft.getCatalogueJson());
        courseCatalogueRepository.save(catalogue);

        return toResponse(draft, false);
    }

    /** Discards the current DRAFT (editor falls back to the published config). */
    @Transactional
    public void discardDraft(String catalogueId) {
        requireCatalogue(catalogueId);
        revisionRepository
                .findFirstByCatalogueIdAndStatusOrderByRevisionNoDescIdDesc(catalogueId,
                        CatalogueRevisionStatusEnum.DRAFT.name())
                .ifPresent(draft -> {
                    draft.setStatus(CatalogueRevisionStatusEnum.DISCARDED.name());
                    revisionRepository.save(draft);
                });
    }

    /** Revision history (draft + published), newest first, without JSON bodies. */
    @Transactional(readOnly = true)
    public List<RevisionResponse> getHistory(String catalogueId) {
        return revisionRepository
                .findByCatalogueIdAndStatusInOrderByRevisionNoDescIdDesc(catalogueId,
                        List.of(CatalogueRevisionStatusEnum.DRAFT.name(),
                                CatalogueRevisionStatusEnum.PUBLISHED.name()))
                .stream()
                .map(r -> toResponse(r, false))
                .collect(Collectors.toList());
    }

    /** One revision with its full JSON (for history preview / rollback). */
    @Transactional(readOnly = true)
    public RevisionResponse getRevision(String revisionId) {
        CatalogueRevision revision = revisionRepository.findById(revisionId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Revision not found"));
        return toResponse(revision, true);
    }

    /** Loads the parent catalogue with a row lock, serializing all revision
     *  writers for one catalogue (draft upsert / publish / discard races). */
    private CourseCatalogue requireCatalogue(String catalogueId) {
        return courseCatalogueRepository.findByIdForUpdate(catalogueId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Catalogue not found"));
    }

    /** Records a PUBLISHED revision for a legacy direct write to
     *  course_catalogue.catalogue_json, so out-of-band edits stay visible and
     *  restorable in history. */
    @Transactional
    public void recordLegacyPublishedRevision(String catalogueId, String catalogueJson, String userId) {
        requireCatalogue(catalogueId);
        CatalogueRevision revision = CatalogueRevision.builder()
                .catalogueId(catalogueId)
                .revisionNo(nextRevisionNo(catalogueId))
                .catalogueJson(catalogueJson)
                .status(CatalogueRevisionStatusEnum.PUBLISHED.name())
                .source("LEGACY_UPDATE")
                .createdByUserId(userId)
                .build();
        revisionRepository.save(revision);
    }

    private Integer nextRevisionNo(String catalogueId) {
        return revisionRepository.findFirstByCatalogueIdOrderByRevisionNoDescIdDesc(catalogueId)
                .map(r -> r.getRevisionNo() + 1)
                .orElse(1);
    }

    private RevisionResponse toResponse(CatalogueRevision r, boolean includeJson) {
        return RevisionResponse.builder()
                .id(r.getId())
                .revisionNo(r.getRevisionNo())
                .status(r.getStatus())
                .source(r.getSource())
                .aiRunId(r.getAiRunId())
                .createdByUserId(r.getCreatedByUserId())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .catalogueJson(includeJson ? r.getCatalogueJson() : null)
                .build();
    }
}
