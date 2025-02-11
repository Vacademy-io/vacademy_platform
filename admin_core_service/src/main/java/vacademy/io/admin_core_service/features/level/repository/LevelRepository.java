package vacademy.io.admin_core_service.features.level.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.institute.entity.Level;

import java.util.List;

@Repository
public interface LevelRepository extends JpaRepository<Level,String> {

            @Query(value = """
                    SELECT DISTINCT l.* 
                    FROM level l
                    JOIN package_session ps ON l.id = ps.level_id
                    JOIN package p ON ps.package_id = p.id
                    JOIN package_institute pi ON p.id = pi.package_id
                    WHERE pi.institute_id = :instituteId AND ps.session_id = :sessionId AND l.status = 'ACTIVE' AND ps.status = 'ACTIVE'
        """, nativeQuery = true)
            List<Level> findDistinctLevelsByInstituteIdAndSessionId(@Param("instituteId") String instituteId,
                                                                    @Param("sessionId") String sessionId);

}
