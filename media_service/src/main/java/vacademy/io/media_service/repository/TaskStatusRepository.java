package vacademy.io.media_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.enums.TaskStatus;

import java.util.List;

@Repository
public interface TaskStatusRepository extends JpaRepository<TaskStatus, String> {
    List<TaskStatus> findByStatus(String status);
    List<TaskStatus> findByInstituteId(String instituteId);
    List<TaskStatus> findByInputType(String inputType);

    List<TaskStatus> findByInstituteIdAndType(String instituteId, String type);
}
