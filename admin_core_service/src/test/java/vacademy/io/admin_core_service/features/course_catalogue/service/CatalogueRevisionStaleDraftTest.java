package vacademy.io.admin_core_service.features.course_catalogue.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CatalogueRevisionDTOs.RevisionResponse;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CatalogueRevisionDTOs.SaveDraftRequest;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueRequest;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueResponse;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueInstituteMapping;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueRevision;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CourseCatalogue;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CatalogueInstituteMappingRepository;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CatalogueRevisionRepository;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CourseCatalogueRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * A draft started before the live site changed must not silently undo that
 * change on publish. The revision table is kept in memory with a ticking
 * clock standing in for @CreationTimestamp / @UpdateTimestamp.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CatalogueRevisionStaleDraftTest {

    private static final String CATALOGUE = "cat-1";
    private static final String LIVE = "{\"pages\":[{\"route\":\"home\",\"title\":\"Old\"}]}";
    private static final String DRAFT = "{\"pages\":[{\"route\":\"home\",\"title\":\"Draft edit\"}]}";
    private static final String NEWER_LIVE = "{\"pages\":[{\"route\":\"home\",\"title\":\"Fixed live\"}]}";

    @Mock private CatalogueRevisionRepository revisionRepository;
    @Mock private CourseCatalogueRepository courseCatalogueRepository;
    @Mock private CatalogueInstituteMappingRepository mappingRepository;

    private final List<CatalogueRevision> rows = new ArrayList<>();
    private long clock = 1_000_000L;
    private CourseCatalogue catalogue;
    private CatalogueRevisionService revisions;
    private CourseCatalogueService catalogues;

    @BeforeEach
    void setUp() {
        catalogue = CourseCatalogue.builder().id(CATALOGUE).catalogueJson(LIVE).tagName("site").build();
        when(courseCatalogueRepository.findByIdForUpdate(CATALOGUE)).thenReturn(Optional.of(catalogue));
        when(courseCatalogueRepository.findById(CATALOGUE)).thenReturn(Optional.of(catalogue));
        when(courseCatalogueRepository.save(any(CourseCatalogue.class))).thenAnswer(i -> i.getArgument(0));

        when(revisionRepository.save(any(CatalogueRevision.class))).thenAnswer(i -> {
            CatalogueRevision r = i.getArgument(0);
            Date now = new Date(clock += 1000);
            if (r.getId() == null) {
                r.setId(UUID.randomUUID().toString());
                r.setCreatedAt(now);
                rows.add(r);
            }
            r.setUpdatedAt(now);
            return r;
        });
        when(revisionRepository.findFirstByCatalogueIdAndStatusOrderByRevisionNoDescIdDesc(eq(CATALOGUE), anyString()))
                .thenAnswer(i -> rows.stream().filter(r -> r.getStatus().equals(i.getArgument(1)))
                        .max(Comparator.comparing(CatalogueRevision::getRevisionNo)));
        when(revisionRepository.findFirstByCatalogueIdAndStatusOrderByUpdatedAtDescIdDesc(eq(CATALOGUE), anyString()))
                .thenAnswer(i -> rows.stream().filter(r -> r.getStatus().equals(i.getArgument(1)))
                        .max(Comparator.comparing(CatalogueRevision::getUpdatedAt)));
        when(revisionRepository.findFirstByCatalogueIdAndStatusAndUpdatedAtLessThanEqualOrderByUpdatedAtDescIdDesc(
                eq(CATALOGUE), anyString(), any(Date.class)))
                .thenAnswer(i -> rows.stream().filter(r -> r.getStatus().equals(i.getArgument(1))
                                && !r.getUpdatedAt().after(i.getArgument(2)))
                        .max(Comparator.comparing(CatalogueRevision::getUpdatedAt)));
        when(revisionRepository.findFirstByCatalogueIdAndRevisionNoAndStatusOrderByUpdatedAtDescIdDesc(
                eq(CATALOGUE), any(Integer.class), anyString()))
                .thenAnswer(i -> rows.stream().filter(r -> r.getRevisionNo().equals(i.getArgument(1))
                                && r.getStatus().equals(i.getArgument(2)))
                        .max(Comparator.comparing(CatalogueRevision::getUpdatedAt)));
        when(revisionRepository.findFirstByCatalogueIdOrderByRevisionNoDescIdDesc(CATALOGUE))
                .thenAnswer(i -> rows.stream().max(Comparator.comparing(CatalogueRevision::getRevisionNo)));

        Institute institute = new Institute();
        institute.setId("inst-1");
        when(mappingRepository.findByCourseCatalogueId(CATALOGUE)).thenReturn(Optional.of(
                CatalogueInstituteMapping.builder().courseCatalogue(catalogue).institute(institute).build()));

        revisions = new CatalogueRevisionService();
        ReflectionTestUtils.setField(revisions, "revisionRepository", revisionRepository);
        ReflectionTestUtils.setField(revisions, "courseCatalogueRepository", courseCatalogueRepository);
        ReflectionTestUtils.setField(revisions, "staleGuardEnabled", true);
        catalogues = new CourseCatalogueService();
        ReflectionTestUtils.setField(catalogues, "courseCatalogueRepository", courseCatalogueRepository);
        ReflectionTestUtils.setField(catalogues, "catalogueInstituteMappingRepository", mappingRepository);
        ReflectionTestUtils.setField(catalogues, "catalogueRevisionService", revisions);

        // History starts with the current live version on record
        revisions.recordLegacyPublishedRevision(CATALOGUE, LIVE, "u0");
    }

    private void saveDraft(String json) {
        revisions.saveDraft(CATALOGUE, new SaveDraftRequest(json, "MANUAL", null), "editor");
    }

    /** The legacy direct write (PUT /update), as scripts use it. */
    private CourseCatalogueResponse legacyUpdate(String json) {
        CourseCatalogueRequest request = new CourseCatalogueRequest();
        request.setCatalogueJson(json);
        return catalogues.updateCatalogue(CATALOGUE, request, "script");
    }

    @Test
    void draftThenDifferentLiveWriteIsStale() {
        saveDraft(DRAFT);
        CourseCatalogueResponse updated = legacyUpdate(NEWER_LIVE);

        RevisionResponse draft = revisions.getDraft(CATALOGUE).orElseThrow();
        assertTrue(draft.getLiveChangedSinceDraft());
        assertEquals(3, draft.getLiveRevisionNo());
        assertEquals(rows.get(2).getUpdatedAt(), draft.getLiveUpdatedAt());
        // The update never discards the open draft; it reports it instead
        assertEquals(2, updated.getOpenDraftRevisionNo());
        assertEquals(DRAFT, draft.getCatalogueJson());
    }

    @Test
    void draftThenIdenticalLiveWriteIsNotStale() {
        saveDraft(DRAFT);
        // Same tree, different formatting and key order (Python's json.dumps style)
        legacyUpdate("{\"pages\": [{\"title\": \"Draft edit\", \"route\": \"home\"}]}");

        assertFalse(revisions.getDraft(CATALOGUE).orElseThrow().getLiveChangedSinceDraft());
    }

    @Test
    void republishingTheSameLiveContentIsNotStale() {
        saveDraft(DRAFT);
        // A settings-only update re-sends the JSON that was live when the draft started
        legacyUpdate(LIVE);

        assertFalse(revisions.getDraft(CATALOGUE).orElseThrow().getLiveChangedSinceDraft());
        assertEquals("PUBLISHED", revisions.publish(CATALOGUE, "editor", false, null).getStatus());
    }

    @Test
    void draftOlderThanAllHistoryIsStaleOnceLiveChanges() {
        rows.clear();
        saveDraft(DRAFT);
        legacyUpdate(NEWER_LIVE);

        assertTrue(revisions.getDraft(CATALOGUE).orElseThrow().getLiveChangedSinceDraft());
    }

    @Test
    void publishingStaleDraftIsRefusedUnlessOverridden() {
        saveDraft(DRAFT);
        legacyUpdate(NEWER_LIVE);

        VacademyException ex = assertThrows(VacademyException.class,
                () -> revisions.publish(CATALOGUE, "editor", false, null));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().startsWith(CatalogueRevisionService.DRAFT_OLDER_THAN_LIVE));
        assertEquals(NEWER_LIVE, catalogue.getCatalogueJson());

        RevisionResponse published = revisions.publish(CATALOGUE, "editor", true, null);
        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(DRAFT, catalogue.getCatalogueJson());
        // The promoted draft becomes the newest number, above the legacy write
        assertEquals(4, published.getRevisionNo());
        assertTrue(revisions.getDraft(CATALOGUE).isEmpty());
    }

    @Test
    void freshDraftPublishesAsBefore() {
        saveDraft(DRAFT);

        RevisionResponse draft = revisions.getDraft(CATALOGUE).orElseThrow();
        assertFalse(draft.getLiveChangedSinceDraft());
        assertEquals(1, draft.getLiveRevisionNo());

        RevisionResponse published = revisions.publish(CATALOGUE, "editor", false, null);
        assertEquals("PUBLISHED", published.getStatus());
        assertEquals(2, published.getRevisionNo());
        assertEquals(DRAFT, catalogue.getCatalogueJson());
    }

    @Test
    void publishRefusesWhenLiveMovedSinceEditorLoadedIt() {
        // Editor loaded live v1, someone wrote v2, the editor's first save creates the draft
        legacyUpdate(NEWER_LIVE);
        saveDraft(DRAFT);

        VacademyException ex = assertThrows(VacademyException.class,
                () -> revisions.publish(CATALOGUE, "editor", false, 1));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("after you opened the editor"));
        // Knowing the current live number publishes normally
        assertEquals("PUBLISHED", revisions.publish(CATALOGUE, "editor", false, 2).getStatus());
    }

    @Test
    void draftWithNoPublishedHistoryIsNotStale() {
        rows.clear();
        saveDraft(DRAFT);

        RevisionResponse draft = revisions.getDraft(CATALOGUE).orElseThrow();
        assertFalse(draft.getLiveChangedSinceDraft());
        assertNull(draft.getLiveRevisionNo());
    }

    @Test
    void updateReportsNoOpenDraftAfterDiscard() {
        saveDraft(DRAFT);
        revisions.discardDraft(CATALOGUE);

        assertNull(legacyUpdate(NEWER_LIVE).getOpenDraftRevisionNo());
    }

    @Test
    void sameContentWrittenAgainSinceEditorLoadedIsNotAConflict() {
        // Live goes v1 -> v2 -> back to v1's content as v3; the editor loaded v1
        legacyUpdate(NEWER_LIVE);
        legacyUpdate(LIVE);
        saveDraft(DRAFT);

        assertEquals("PUBLISHED", revisions.publish(CATALOGUE, "editor", false, 1).getStatus());
        assertEquals(DRAFT, catalogue.getCatalogueJson());
    }

    @Test
    void settingsOnlyUpdateWithoutAnyHistoryIsNotStale() {
        // A site made by /create (or before revisions existed) has no PUBLISHED row
        rows.clear();
        saveDraft(DRAFT);
        legacyUpdate(LIVE);

        assertFalse(revisions.getDraft(CATALOGUE).orElseThrow().getLiveChangedSinceDraft());
        assertEquals(1, rows.size());
        assertEquals("PUBLISHED", revisions.publish(CATALOGUE, "editor", false, null).getStatus());
    }

    @Test
    void staleDraftPublishesWhileTheGuardIsOff() {
        ReflectionTestUtils.setField(revisions, "staleGuardEnabled", false);
        saveDraft(DRAFT);
        legacyUpdate(NEWER_LIVE);

        // Still reported, so the editor and AI tools can warn
        assertTrue(revisions.getDraft(CATALOGUE).orElseThrow().getLiveChangedSinceDraft());
        assertEquals("PUBLISHED", revisions.publish(CATALOGUE, "editor", false, 1).getStatus());
        assertEquals(DRAFT, catalogue.getCatalogueJson());
    }
}
