package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.LeadAssignmentCounter;

import java.util.Optional;

@Repository
public interface LeadAssignmentCounterRepository extends JpaRepository<LeadAssignmentCounter, String> {

    Optional<LeadAssignmentCounter> findByScopeTypeAndScopeId(String scopeType, String scopeId);

    /**
     * Atomically increment last_index and return the new value.
     * This prevents race conditions in round-robin assignment.
     */
    @Modifying
    @Query(value = """
        INSERT INTO lead_assignment_counter (id, scope_type, scope_id, last_index, created_at, updated_at)
        VALUES (gen_random_uuid()::text, :scopeType, :scopeId, 1, NOW(), NOW())
        ON CONFLICT (scope_type, scope_id)
        DO UPDATE SET last_index = lead_assignment_counter.last_index + 1, updated_at = NOW()
        """, nativeQuery = true)
    void incrementCounter(@Param("scopeType") String scopeType, @Param("scopeId") String scopeId);
}
