package vacademy.io.community_service.feature.support.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.support.entity.InstituteEngineerAssignment;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface InstituteEngineerAssignmentRepository
        extends JpaRepository<InstituteEngineerAssignment, String> {

    List<InstituteEngineerAssignment> findByInstituteId(String instituteId);

    List<InstituteEngineerAssignment> findByInstituteIdIn(Collection<String> instituteIds);

    List<InstituteEngineerAssignment> findByEngineerId(String engineerId);

    Optional<InstituteEngineerAssignment> findByInstituteIdAndEngineerId(String instituteId, String engineerId);

    void deleteByInstituteId(String instituteId);

    void deleteByEngineerId(String engineerId);
}
