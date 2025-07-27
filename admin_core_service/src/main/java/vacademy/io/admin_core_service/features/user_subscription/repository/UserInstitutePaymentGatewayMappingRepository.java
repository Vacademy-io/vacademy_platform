package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserInstitutePaymentGatewayMapping;

import java.util.List;
import java.util.Optional;

public interface UserInstitutePaymentGatewayMappingRepository extends JpaRepository<UserInstitutePaymentGatewayMapping, String> {
    @Query("""
        SELECT u FROM UserInstitutePaymentGatewayMapping u
        JOIN u.institutePaymentGatewayMapping ipgm
        WHERE u.userId = :userId
          AND ipgm.instituteId = :instituteId
          AND ipgm.vendor = :vendor
          AND ipgm.status IN :gatewayStatuses
          AND u.status IN :userMappingStatuses
    """)
    Optional<UserInstitutePaymentGatewayMapping> findByUserIdAndInstituteIdAndVendorAndStatuses(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId,
            @Param("vendor") String vendor,
            @Param("gatewayStatuses") List<String> gatewayStatuses,
            @Param("userMappingStatuses") List<String> userMappingStatuses
    );
}
