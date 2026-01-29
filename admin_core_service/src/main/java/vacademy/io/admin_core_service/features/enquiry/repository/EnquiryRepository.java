package vacademy.io.admin_core_service.features.enquiry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for Enquiry entity
 */
@Repository
public interface EnquiryRepository extends JpaRepository<Enquiry, UUID>, EnquiryRepositoryCustom {

    /**
     * Find enquiry by tracking ID
     */
    Optional<Enquiry> findByEnquiryTrackingId(String enquiryTrackingId);
}
