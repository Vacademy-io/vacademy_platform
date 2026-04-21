package vacademy.io.admin_core_service.features.doubts.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;

import java.util.Date;
import java.util.List;

@Repository
public interface DoubtsRepository extends JpaRepository<Doubts, String> {

    @Query(value = """
        SELECT d.* FROM doubts d
        WHERE (:contentPositions IS NULL OR d.content_position IN :contentPositions)
          AND (:contentTypes IS NULL OR d.content_type IN :contentTypes)
          AND (:sources IS NULL OR d.source IN :sources)
          AND (:sourceIds IS NULL OR d.source_id IN :sourceIds)
          AND (:userIds IS NULL OR d.user_id IN :userIds)
          AND (:status IS NULL OR d.status IN :status)
          AND (d.raised_time BETWEEN :startDate AND :endDate)
          AND d.parent_id IS NULL
          AND (:batchIds IS NULL OR d.package_session_id IN :batchIds)
        """,
            countQuery = """
        SELECT COUNT(d.*) FROM doubts d
        WHERE (:contentPositions IS NULL OR d.content_position IN :contentPositions)
          AND (:contentTypes IS NULL OR d.content_type IN :contentTypes)
          AND (:sources IS NULL OR d.source IN :sources)
          AND (:sourceIds IS NULL OR d.source_id IN :sourceIds)
          AND (:userIds IS NULL OR d.user_id IN :userIds)
          AND (:status IS NULL OR d.status IN :status)
          AND (d.raised_time BETWEEN :startDate AND :endDate)
          AND d.parent_id IS NULL
          AND (d.package_session_id IN :batchIds)
        """,nativeQuery = true)
    Page<Doubts> findDoubtsWithFilter(@Param("contentPositions") List<String> contentPositions,
                                      @Param("contentTypes") List<String> contentTypes,
                                      @Param("sources") List<String> sources,
                                      @Param("sourceIds") List<String> sourceIds,
                                      @Param("userIds") List<String> userIds,
                                      @Param("status") List<String> status,
                                      @Param("batchIds") List<String> batchIds,
                                      @Param("startDate") Date startDate,
                                      @Param("endDate") Date endDate,
                                      Pageable pageable);

    /**
     * Same filter set as {@link #findDoubtsWithFilter}, additionally restricted to doubts
     * that are visible to the given viewer user. A doubt is visible if any of:
     *   - the viewer raised the doubt themselves (d.user_id = :viewerUserId), so students still
     *     see their own questions and can follow replies
     *   - the viewer is directly assigned via doubt_assignee (source='USER', status='ACTIVE')
     *   - the viewer has an ACTIVE batch-level FSPSSM (subject_id IS NULL) for the doubt's
     *     package_session (covering both legacy package_session_id and access_type='PACKAGE_SESSION')
     *   - the viewer has an ACTIVE subject-level FSPSSM (subject_id IS NOT NULL) where the doubt's
     *     slide maps back to the mapping's subject via module_chapter_mapping/subject_module_mapping
     */
    @Query(value = """
        SELECT d.* FROM doubts d
        WHERE (:contentPositions IS NULL OR d.content_position IN :contentPositions)
          AND (:contentTypes IS NULL OR d.content_type IN :contentTypes)
          AND (:sources IS NULL OR d.source IN :sources)
          AND (:sourceIds IS NULL OR d.source_id IN :sourceIds)
          AND (:userIds IS NULL OR d.user_id IN :userIds)
          AND (:status IS NULL OR d.status IN :status)
          AND (d.raised_time BETWEEN :startDate AND :endDate)
          AND d.parent_id IS NULL
          AND (:batchIds IS NULL OR d.package_session_id IN :batchIds)
          AND (
            d.user_id = :viewerUserId
            OR EXISTS (
                SELECT 1 FROM doubt_assignee da
                WHERE da.doubt_id = d.id
                  AND da.source = 'USER'
                  AND da.source_id = :viewerUserId
                  AND da.status = 'ACTIVE'
            )
            OR EXISTS (
                SELECT 1 FROM faculty_subject_package_session_mapping fm
                WHERE fm.user_id = :viewerUserId
                  AND fm.status = 'ACTIVE'
                  AND fm.subject_id IS NULL
                  AND (
                      fm.package_session_id = d.package_session_id
                      OR (fm.access_type = 'PACKAGE_SESSION' AND fm.access_id = d.package_session_id)
                  )
            )
            OR EXISTS (
                SELECT 1 FROM faculty_subject_package_session_mapping fm
                JOIN subject_module_mapping smm ON smm.subject_id = fm.subject_id
                JOIN module_chapter_mapping mcm ON mcm.module_id = smm.module_id
                JOIN chapter_to_slides cs ON cs.chapter_id = mcm.chapter_id
                WHERE fm.user_id = :viewerUserId
                  AND fm.status = 'ACTIVE'
                  AND fm.subject_id IS NOT NULL
                  AND (
                      fm.package_session_id = d.package_session_id
                      OR (fm.access_type = 'PACKAGE_SESSION' AND fm.access_id = d.package_session_id)
                  )
                  AND cs.slide_id = d.source_id
                  AND d.source = 'SLIDE'
            )
          )
        """,
            countQuery = """
        SELECT COUNT(d.*) FROM doubts d
        WHERE (:contentPositions IS NULL OR d.content_position IN :contentPositions)
          AND (:contentTypes IS NULL OR d.content_type IN :contentTypes)
          AND (:sources IS NULL OR d.source IN :sources)
          AND (:sourceIds IS NULL OR d.source_id IN :sourceIds)
          AND (:userIds IS NULL OR d.user_id IN :userIds)
          AND (:status IS NULL OR d.status IN :status)
          AND (d.raised_time BETWEEN :startDate AND :endDate)
          AND d.parent_id IS NULL
          AND (d.package_session_id IN :batchIds)
          AND (
            d.user_id = :viewerUserId
            OR EXISTS (
                SELECT 1 FROM doubt_assignee da
                WHERE da.doubt_id = d.id
                  AND da.source = 'USER'
                  AND da.source_id = :viewerUserId
                  AND da.status = 'ACTIVE'
            )
            OR EXISTS (
                SELECT 1 FROM faculty_subject_package_session_mapping fm
                WHERE fm.user_id = :viewerUserId
                  AND fm.status = 'ACTIVE'
                  AND fm.subject_id IS NULL
                  AND (
                      fm.package_session_id = d.package_session_id
                      OR (fm.access_type = 'PACKAGE_SESSION' AND fm.access_id = d.package_session_id)
                  )
            )
            OR EXISTS (
                SELECT 1 FROM faculty_subject_package_session_mapping fm
                JOIN subject_module_mapping smm ON smm.subject_id = fm.subject_id
                JOIN module_chapter_mapping mcm ON mcm.module_id = smm.module_id
                JOIN chapter_to_slides cs ON cs.chapter_id = mcm.chapter_id
                WHERE fm.user_id = :viewerUserId
                  AND fm.status = 'ACTIVE'
                  AND fm.subject_id IS NOT NULL
                  AND (
                      fm.package_session_id = d.package_session_id
                      OR (fm.access_type = 'PACKAGE_SESSION' AND fm.access_id = d.package_session_id)
                  )
                  AND cs.slide_id = d.source_id
                  AND d.source = 'SLIDE'
            )
          )
        """, nativeQuery = true)
    Page<Doubts> findDoubtsWithFilterForViewer(@Param("contentPositions") List<String> contentPositions,
                                               @Param("contentTypes") List<String> contentTypes,
                                               @Param("sources") List<String> sources,
                                               @Param("sourceIds") List<String> sourceIds,
                                               @Param("userIds") List<String> userIds,
                                               @Param("status") List<String> status,
                                               @Param("batchIds") List<String> batchIds,
                                               @Param("startDate") Date startDate,
                                               @Param("endDate") Date endDate,
                                               @Param("viewerUserId") String viewerUserId,
                                               Pageable pageable);

    List<Doubts> findByParentIdAndStatusNotIn(String doubtId, List<String> name);
}
