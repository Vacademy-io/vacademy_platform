package vacademy.io.admin_core_service.features.invoice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.invoice.entity.InvoiceBillingProfile;

import java.util.Optional;

@Repository
public interface InvoiceBillingProfileRepository extends JpaRepository<InvoiceBillingProfile, String> {

    Optional<InvoiceBillingProfile> findByUserIdAndInstituteId(String userId, String instituteId);
}
