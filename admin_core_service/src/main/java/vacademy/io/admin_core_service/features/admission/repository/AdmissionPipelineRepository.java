package vacademy.io.admin_core_service.features.admission.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.admission.entity.AdmissionPipeline;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdmissionPipelineRepository extends JpaRepository<AdmissionPipeline, UUID> {

    Optional<AdmissionPipeline> findByChildUserIdAndInstituteId(String childUserId, String instituteId);
    
    Optional<AdmissionPipeline> findByEnquiryId(String enquiryId);
    
    Optional<AdmissionPipeline> findByApplicantId(String applicantId);

    // ── Per-session queries (packageSessionId required) ──────────────────────

    long countByInstituteIdAndPackageSessionIdAndLeadStatus(String instituteId, String packageSessionId, String leadStatus);

    long countByInstituteIdAndPackageSessionId(String instituteId, String packageSessionId);

    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.packageSessionId = :packageSessionId AND ap.leadStatus = 'ADMITTED' AND ap.enquiryId IS NOT NULL")
    long countAdmissionsFromEnquiry(@Param("instituteId") String instituteId, @Param("packageSessionId") String packageSessionId);

    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.packageSessionId = :packageSessionId AND ap.leadStatus = 'ADMITTED' " +
           "AND ap.enquiryId IS NULL AND ap.applicantId IS NOT NULL")
    long countAdmissionsFromApplicationOnly(@Param("instituteId") String instituteId, @Param("packageSessionId") String packageSessionId);

    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.packageSessionId = :packageSessionId AND ap.leadStatus = 'ADMITTED' " +
           "AND ap.enquiryId IS NULL AND ap.applicantId IS NULL")
    long countDirectAdmissions(@Param("instituteId") String instituteId, @Param("packageSessionId") String packageSessionId);

    // ── Institute-wide queries (no packageSessionId filter) ───────────────────

    long countByInstituteIdAndLeadStatus(String instituteId, String leadStatus);

    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.leadStatus = 'ADMITTED' AND ap.enquiryId IS NOT NULL")
    long countAdmissionsFromEnquiryByInstitute(@Param("instituteId") String instituteId);

    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.leadStatus = 'ADMITTED' AND ap.enquiryId IS NULL AND ap.applicantId IS NOT NULL")
    long countAdmissionsFromApplicationOnlyByInstitute(@Param("instituteId") String instituteId);

    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.leadStatus = 'ADMITTED' AND ap.enquiryId IS NULL AND ap.applicantId IS NULL")
    long countDirectAdmissionsByInstitute(@Param("instituteId") String instituteId);

    // ── Pagination queries for user listing ───────────────────────────────

    org.springframework.data.domain.Page<AdmissionPipeline> findByInstituteIdAndLeadStatus(String instituteId, String leadStatus, org.springframework.data.domain.Pageable pageable);

    org.springframework.data.domain.Page<AdmissionPipeline> findByInstituteIdAndPackageSessionIdAndLeadStatus(String instituteId, String packageSessionId, String leadStatus, org.springframework.data.domain.Pageable pageable);
}
