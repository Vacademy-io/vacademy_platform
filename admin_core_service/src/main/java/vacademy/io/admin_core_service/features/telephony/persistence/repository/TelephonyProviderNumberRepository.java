package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;

import java.util.List;

@Repository
public interface TelephonyProviderNumberRepository
        extends JpaRepository<TelephonyProviderNumber, String> {

    @Query("""
            SELECT n FROM TelephonyProviderNumber n
            WHERE n.configId = :configId AND n.enabled = TRUE
            ORDER BY n.priority ASC, n.id ASC
            """)
    List<TelephonyProviderNumber> findEnabledByConfigId(@Param("configId") String configId);

    @Query("""
            SELECT n FROM TelephonyProviderNumber n
            WHERE n.instituteId = :instituteId
            ORDER BY n.priority ASC, n.id ASC
            """)
    List<TelephonyProviderNumber> findByInstituteId(@Param("instituteId") String instituteId);
}
