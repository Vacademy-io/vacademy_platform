package vacademy.io.admin_core_service.features.enroll_invite.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;

import java.util.List;
import java.util.Optional; // Added for findByInviteCode

@Repository
public interface EnrollInviteRepository extends JpaRepository<EnrollInvite, String> {
    // Example: Find an enroll invite by its invite code
    Optional<EnrollInvite> findByInviteCode(String inviteCode);

    // Example: Find all invites for a specific institute
    // List<EnrollInvite> findByInstituteId(String instituteId);

    @Query("SELECT ei FROM EnrollInvite ei WHERE ei.instituteId = :instituteId " +
            "AND (:#{#tags == null or #tags.isEmpty()} = true OR ei.tag IN :tags) " +
            "AND (:#{#enrollInviteStatus == null or #enrollInviteStatus.isEmpty()} = true OR ei.status IN :enrollInviteStatus) " +
            "AND (:#{#packageSessionIds == null or #packageSessionIds.isEmpty()} = true OR EXISTS (SELECT 1 FROM PackageSessionLearnerInvitationToPaymentOption psl WHERE psl.enrollInvite.id = ei.id AND psl.packageSession.id IN :packageSessionIds)) " +
            "AND (:#{#paymentOptionIds == null or #paymentOptionIds.isEmpty()} = true OR EXISTS (SELECT 1 FROM PackageSessionLearnerInvitationToPaymentOption psl WHERE psl.enrollInvite.id = ei.id AND psl.paymentOption.id IN :paymentOptionIds))")
    Page<EnrollInvite> getEnrollInvitesByInstituteIdAndFilters(
            @Param("instituteId") String instituteId,
            @Param("packageSessionIds") List<String> packageSessionIds,
            @Param("paymentOptionIds") List<String> paymentOptionIds,
            @Param("tags") List<String> tags,
            @Param("enrollInviteStatus") List<String> enrollInviteStatus,
            Pageable pageable
    );

    @Query("SELECT ei FROM EnrollInvite ei WHERE ei.instituteId = :instituteId " +
            "AND (:#{#enrollInviteStatus == null or #enrollInviteStatus.isEmpty()} = true OR ei.status IN :enrollInviteStatus) " +
            "AND (:searchName IS NULL OR :searchName = '' OR " +
            "     LOWER(ei.name) LIKE LOWER(CONCAT('%', :searchName, '%')) OR " +
            "     LOWER(ei.inviteCode) LIKE LOWER(CONCAT('%', :searchName, '%')))")
    Page<EnrollInvite> getEnrollInvitesByInstituteIdAndSearchName(
            @Param("instituteId") String instituteId,
            @Param("searchName") String searchName,
            @Param("enrollInviteStatus") List<String> enrollInviteStatus,
            Pageable pageable
    );
}