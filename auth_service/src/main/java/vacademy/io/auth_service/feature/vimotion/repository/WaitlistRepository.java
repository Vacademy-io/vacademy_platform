package vacademy.io.auth_service.feature.vimotion.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.vimotion.entity.WaitlistEntry;

import java.util.List;
import java.util.Optional;

@Repository
public interface WaitlistRepository extends JpaRepository<WaitlistEntry, String> {

    @Query("SELECT w FROM WaitlistEntry w WHERE LOWER(w.email) = LOWER(:email)")
    Optional<WaitlistEntry> findByEmailIgnoreCase(@Param("email") String email);

    Optional<WaitlistEntry> findByReferralCode(String referralCode);

    /**
     * Pulls the next position number from the Postgres sequence. Using a
     * sequence (vs MAX(position)+1) makes concurrent joins collision-free —
     * each request gets a distinct number even under launch-day spikes.
     */
    @Query(value = "SELECT nextval('vimotion_waitlist_position_seq')", nativeQuery = true)
    int nextPosition();

    /**
     * Bumps the referral_count on the referrer row. Returns 1 on success,
     * 0 if the referrer no longer exists (caller treats as a no-op).
     */
    @Modifying
    @Query("UPDATE WaitlistEntry w SET w.referralCount = w.referralCount + 1 WHERE w.id = :id")
    int incrementReferralCount(@Param("id") String id);

    /* ====================== Admin finders ====================== */

    @Query("SELECT w FROM WaitlistEntry w WHERE "
            + "(:status IS NULL OR w.status = :status) AND "
            + "(:q IS NULL OR LOWER(w.email) LIKE LOWER(CONCAT('%', :q, '%')) "
            + "             OR LOWER(w.fullName) LIKE LOWER(CONCAT('%', :q, '%')) "
            + "             OR w.phoneNumber LIKE CONCAT('%', :q, '%'))")
    Page<WaitlistEntry> search(@Param("status") String status,
                               @Param("q") String q,
                               Pageable pageable);

    long countByStatus(String status);

    @Query("SELECT w FROM WaitlistEntry w "
            + "WHERE w.referralCount > 0 "
            + "ORDER BY w.referralCount DESC, w.position ASC")
    List<WaitlistEntry> findTopReferrers(Pageable pageable);
}
