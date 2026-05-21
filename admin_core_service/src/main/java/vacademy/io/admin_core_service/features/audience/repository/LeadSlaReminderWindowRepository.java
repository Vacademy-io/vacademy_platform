package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.LeadSlaReminderWindow;

import java.util.List;

@Repository
public interface LeadSlaReminderWindowRepository extends JpaRepository<LeadSlaReminderWindow, String> {

    List<LeadSlaReminderWindow> findByInstituteIdAndSlaTypeOrderByDisplayOrderAsc(String instituteId, String slaType);

    @Transactional
    void deleteByInstituteIdAndSlaType(String instituteId, String slaType);
}
