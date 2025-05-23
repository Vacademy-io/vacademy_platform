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
        """,nativeQuery = true)
    Page<Doubts> findDoubtsWithFilter(@Param("contentPositions") List<String> contentPositions,
                                      @Param("contentTypes") List<String> contentTypes,
                                      @Param("sources") List<String> sources,
                                      @Param("sourceIds") List<String> sourceIds,
                                      @Param("userIds") List<String> userIds,
                                      @Param("status") List<String> status,
                                      @Param("startDate") Date startDate,
                                      @Param("endDate") Date endDate,
                                      Pageable pageable);

    List<Doubts> findByParentIdAndStatusNotIn(String doubtId, List<String> name);
}
