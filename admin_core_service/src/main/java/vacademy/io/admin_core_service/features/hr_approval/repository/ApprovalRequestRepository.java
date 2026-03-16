package vacademy.io.admin_core_service.features.hr_approval.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_approval.entity.ApprovalRequest;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, String> {

    Optional<ApprovalRequest> findByEntityTypeAndEntityId(String entityType, String entityId);

    List<ApprovalRequest> findByInstituteIdAndStatusOrderByCreatedAtDesc(String instituteId, String status);

    @Query("SELECT r FROM ApprovalRequest r WHERE r.instituteId = :instituteId AND r.status = 'PENDING' ORDER BY r.createdAt DESC")
    List<ApprovalRequest> findPendingRequests(@Param("instituteId") String instituteId);

    List<ApprovalRequest> findByRequesterIdAndStatusOrderByCreatedAtDesc(String requesterId, String status);
}
