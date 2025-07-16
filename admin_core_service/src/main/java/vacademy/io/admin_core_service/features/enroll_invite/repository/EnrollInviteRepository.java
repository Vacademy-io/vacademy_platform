package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;

import java.util.Optional; // Added for findByInviteCode

@Repository
public interface EnrollInviteRepository extends JpaRepository<EnrollInvite, String> {
    // Example: Find an enroll invite by its invite code
    Optional<EnrollInvite> findByInviteCode(String inviteCode);

    // Example: Find all invites for a specific institute
    // List<EnrollInvite> findByInstituteId(String instituteId);
}