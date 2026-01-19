package vacademy.io.notification_service.features.bounced_emails.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.notification_service.features.bounced_emails.entity.BouncedEmail;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing bounced email records.
 */
@Repository
public interface BouncedEmailRepository extends JpaRepository<BouncedEmail, String> {

    /**
     * Check if an email is actively blocked (most common operation)
     */
    boolean existsByEmailAndIsActiveTrue(String email);

    /**
     * Find a bounced email record by email address
     */
    Optional<BouncedEmail> findByEmail(String email);

    /**
     * Find a bounced email record by email address (case-insensitive)
     */
    @Query("SELECT b FROM BouncedEmail b WHERE LOWER(b.email) = LOWER(:email)")
    Optional<BouncedEmail> findByEmailIgnoreCase(@Param("email") String email);

    /**
     * Check if an email is blocked (case-insensitive)
     */
    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM BouncedEmail b WHERE LOWER(b.email) = LOWER(:email) AND b.isActive = true")
    boolean isEmailBlocked(@Param("email") String email);

    /**
     * Find all active (blocked) bounced emails with pagination
     */
    Page<BouncedEmail> findByIsActiveTrue(Pageable pageable);

    /**
     * Find all bounced emails with pagination
     */
    Page<BouncedEmail> findAll(Pageable pageable);

    /**
     * Find bounced emails by bounce type
     */
    Page<BouncedEmail> findByBounceTypeAndIsActiveTrue(String bounceType, Pageable pageable);

    /**
     * Count total active blocked emails
     */
    long countByIsActiveTrue();

    /**
     * Count blocked emails by bounce type
     */
    long countByBounceTypeAndIsActiveTrue(String bounceType);

    /**
     * Unblock an email by setting is_active to false
     */
    @Modifying
    @Query("UPDATE BouncedEmail b SET b.isActive = false, b.updatedAt = CURRENT_TIMESTAMP WHERE LOWER(b.email) = LOWER(:email)")
    int unblockEmail(@Param("email") String email);

    /**
     * Re-block a previously unblocked email
     */
    @Modifying
    @Query("UPDATE BouncedEmail b SET b.isActive = true, b.updatedAt = CURRENT_TIMESTAMP WHERE LOWER(b.email) = LOWER(:email)")
    int reblockEmail(@Param("email") String email);

    /**
     * Search bounced emails by email pattern (for admin search)
     */
    @Query("SELECT b FROM BouncedEmail b WHERE LOWER(b.email) LIKE LOWER(CONCAT('%', :searchTerm, '%')) AND b.isActive = true")
    Page<BouncedEmail> searchByEmail(@Param("searchTerm") String searchTerm, Pageable pageable);

    /**
     * Find multiple emails that are blocked (for batch checking)
     */
    @Query("SELECT b.email FROM BouncedEmail b WHERE LOWER(b.email) IN :emails AND b.isActive = true")
    List<String> findBlockedEmails(@Param("emails") List<String> emails);

    /**
     * Delete old inactive records (for cleanup)
     */
    @Modifying
    @Query("DELETE FROM BouncedEmail b WHERE b.isActive = false AND b.updatedAt < :beforeDate")
    int deleteInactiveRecordsBefore(@Param("beforeDate") java.time.LocalDateTime beforeDate);
}

