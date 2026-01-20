package vacademy.io.admin_core_service.features.enquiry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enquiry.entity.LinkedUsers;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LinkedUsersRepository extends JpaRepository<LinkedUsers, UUID> {

    Optional<LinkedUsers> findBySourceAndSourceId(String source, String sourceId);

    boolean existsBySourceAndSourceId(String source, String sourceId);

    void deleteBySourceAndSourceId(String source, String sourceId);
}
