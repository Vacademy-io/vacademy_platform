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

    // Dashboard query: Count total by status
    long countByInstituteIdAndPackageSessionIdAndLeadStatus(String instituteId, String packageSessionId, String leadStatus);

    // Dashboard query: Count all
    long countByInstituteIdAndPackageSessionId(String instituteId, String packageSessionId);

    // Dashboard query: Converted from Enquiry
    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.packageSessionId = :packageSessionId AND ap.leadStatus = 'ADMITTED' AND ap.enquiryId IS NOT NULL")
    long countAdmissionsFromEnquiry(@Param("instituteId") String instituteId, @Param("packageSessionId") String packageSessionId);

    // Dashboard query: Converted from Application (No Enquiry)
    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.packageSessionId = :packageSessionId AND ap.leadStatus = 'ADMITTED' " +
           "AND ap.enquiryId IS NULL AND ap.applicantId IS NOT NULL")
    long countAdmissionsFromApplicationOnly(@Param("instituteId") String instituteId, @Param("packageSessionId") String packageSessionId);

    // Dashboard query: Direct Admissions
    @Query("SELECT COUNT(ap) FROM AdmissionPipeline ap WHERE ap.instituteId = :instituteId " +
           "AND ap.packageSessionId = :packageSessionId AND ap.leadStatus = 'ADMITTED' " +
           "AND ap.enquiryId IS NULL AND ap.applicantId IS NULL")
    long countDirectAdmissions(@Param("instituteId") String instituteId, @Param("packageSessionId") String packageSessionId);
}
