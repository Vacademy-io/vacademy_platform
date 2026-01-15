package vacademy.io.admin_core_service.features.enquiry.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;

import java.sql.Timestamp;

/**
 * Custom repository for complex enquiry queries
 */
public interface EnquiryRepositoryCustom {
    
    Page<Enquiry> findEnquiriesWithFilters(
            String audienceId,
            String enquiryStatus,
            String sourceType,
            String destinationPackageSessionId,
            Timestamp createdFrom,
            Timestamp createdTo,
            Pageable pageable
    );
}
