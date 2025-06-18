package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ConcentrationScore;

import java.sql.Date;
import java.util.List;

public interface ConcentrationScoreRepository extends JpaRepository<ConcentrationScore, String> {

    @Query(value = """ 
            WITH total_concentration_score AS (
                SELECT 
                    SUM(cs.concentration_score) AS total_score,
                    COUNT(cs.concentration_score) AS score_count
                FROM concentration_score cs
                JOIN activity_log al ON cs.activity_id = al.id
                JOIN student_session_institute_group_mapping ssig ON al.user_id = ssig.user_id
                WHERE 
                    ssig.package_session_id = :packageSessionId
                    AND ssig.status IN :statusList
                    AND al.created_at BETWEEN :startDate AND :endDate
            )
            SELECT 
                CASE 
                    WHEN score_count > 0 THEN total_score / score_count 
                    ELSE NULL 
                END AS avg_concentration_score
            FROM total_concentration_score;
            """, nativeQuery = true)
    Double findAverageConcentrationScoreByBatch(
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("packageSessionId") String packageSessionId,
            @Param("statusList") List<String> statusList
    );

    @Query(value = """ 
            SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN SUM(cs.concentration_score) / COUNT(*) 
                    ELSE NULL 
                END AS avg_concentration_score
            FROM concentration_score cs
            JOIN activity_log al ON cs.activity_id = al.id
            WHERE 
                al.user_id = :userId
                AND al.created_at BETWEEN :startDate AND :endDate
            """, nativeQuery = true)
    Double findAverageConcentrationScoreOfLearner(
            @Param("startDate") Date startDate,
            @Param("endDate") Date endDate,
            @Param("userId") String userId
    );

    @Modifying
    @Transactional
    @Query("DELETE FROM ConcentrationScore cs WHERE cs.activityLog.id = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);

}
