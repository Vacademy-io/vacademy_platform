package vacademy.io.notification_service.features.notification_log.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.notification_log.entity.EmailAddressMapping;

import java.util.Optional;

public interface EmailAddressMappingRepository extends JpaRepository<EmailAddressMapping, String> {

    Optional<EmailAddressMapping> findByEmailAddressAndIsActiveTrue(String emailAddress);

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO email_address_mapping (id, email_address, institute_id, email_type, is_active, created_at, updated_at)
            VALUES (:id, :emailAddress, :instituteId, :emailType, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (email_address, institute_id) DO UPDATE SET
                email_type = EXCLUDED.email_type,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
            """, nativeQuery = true)
    void upsert(
            @Param("id") String id,
            @Param("emailAddress") String emailAddress,
            @Param("instituteId") String instituteId,
            @Param("emailType") String emailType
    );
}
