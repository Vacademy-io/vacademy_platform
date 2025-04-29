package vacademy.io.media_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.TaskStatus;

import java.util.List;

@Repository
public interface TaskStatusRepository extends JpaRepository<TaskStatus, String> {
    List<TaskStatus> findByStatus(String status);

    List<TaskStatus> findByInstituteId(String instituteId);

    List<TaskStatus> findByInputType(String inputType);

    List<TaskStatus> findByInstituteIdAndTypeOrderByCreatedAtDesc(String instituteId, String type);


    @Query(value = """
            SELECT * FROM task_status\s
                    WHERE type = :type\s
                      AND institute_id = :instituteId\s
                      AND input_id = :inputId\s
                      AND input_type = :inputType
                    ORDER BY created_at DESC\s
                    LIMIT 5
            """, nativeQuery = true)
    List<TaskStatus> findLastFiveByTypeAndInstituteAndInput(@Param("type") String type,
                                                            @Param("instituteId") String instituteId,
                                                            @Param("inputId") String inputId,
                                                            @Param("inputType") String inputType);

    @Query(value = """
            SELECT * FROM task_status
            WHERE type = :type
            AND institute_id = :instituteId
            AND input_id = :inputId
            AND input_type = :inputType
            ORDER BY created_at ASC
            """, nativeQuery = true)
    List<TaskStatus> findByTypeAndInstituteIdAndInputIdAndInputTypeOrderByASC(@Param("type") String type,
                                                                              @Param("instituteId") String instituteId,
                                                                              @Param("inputId") String inputId,
                                                                              @Param("inputType") String inputType);

    @Query(value = """
            SELECT * FROM task_status
            WHERE id =:parentId
            OR parent_id =:parentId
            ORDER BY created_at ASC
            """, nativeQuery = true)
    List<TaskStatus> findByParentIdAndTaskWithParentId(@Param("parentId") String parentId);

    @Query(value = """
            SELECT * FROM task_status
            WHERE institute_id = :instituteId
            AND parent_id IS NULL
            """, nativeQuery = true)
    List<TaskStatus> findByInstituteIdAndNullParentId(@Param("instituteId") String instituteId);
}
