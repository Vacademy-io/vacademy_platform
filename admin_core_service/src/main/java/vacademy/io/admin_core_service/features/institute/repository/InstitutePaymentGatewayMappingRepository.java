package vacademy.io.admin_core_service.features.institute.repository;

import org.apache.catalina.LifecycleState;
import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.institute.entity.InstitutePaymentGatewayMapping;

import java.util.List;
import java.util.Optional;

public interface InstitutePaymentGatewayMappingRepository extends JpaRepository<InstitutePaymentGatewayMapping,String> {
    Optional<InstitutePaymentGatewayMapping>findByInstituteIdAndVendorAndStatusIn(String instituteId, String vendor, List<String> status);
}
