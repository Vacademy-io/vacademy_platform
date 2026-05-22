package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.LeadFollowup;

import java.util.List;

@Repository
public interface LeadFollowupRepository extends JpaRepository<LeadFollowup, String> {

    List<LeadFollowup> findByAudienceResponseIdOrderByScheduleTimeAsc(String audienceResponseId);

    List<LeadFollowup> findByCreatedByAndIsClosedFalseOrderByScheduleTimeAsc(String createdBy);

    List<LeadFollowup> findByInstituteIdAndIsClosedFalseOrderByScheduleTimeAsc(String instituteId);
}
