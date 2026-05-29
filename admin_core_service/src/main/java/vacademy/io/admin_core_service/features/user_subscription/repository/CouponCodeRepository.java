package vacademy.io.admin_core_service.features.user_subscription.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;

import java.util.List;
import java.util.Optional;

@Repository
public interface CouponCodeRepository extends JpaRepository<CouponCode, String> {
    // Find a coupon code by its actual code string. Deprecated for institute-scoped
    // lookups because two institutes may share a code post-V309 — kept for legacy
    // callers that have no institute context (the referral path resolves by USER source).
    Optional<CouponCode> findByCode(String code);

    // Institute-scoped lookup — preferred for both admin create (uniqueness check)
    // and the public validate endpoint where institute_id is part of the request.
    Optional<CouponCode> findByInstituteIdAndCode(String instituteId, String code);

    // Legacy PRODUCT_PAGE coupons are still global at lookup time (the product page
    // resolves to a single institute) — used by the backward-compat delegation in
    // ProductPageService.validateCoupon to find a coupon by code without forcing
    // institute scoping ahead of the product-page resolve.
    Optional<CouponCode> findByCodeAndSourceType(String code, String sourceType);

    // Find coupon codes by source ID and source type
    List<CouponCode> findBySourceIdAndSourceType(String sourceId, String sourceType);

    // Find the first coupon code by source ID and source type, ordered by creation date descending
    Optional<CouponCode> findFirstBySourceIdAndSourceTypeOrderByCreatedAtDesc(String sourceId, String sourceType);

    // Find active coupon codes
    List<CouponCode> findByStatus(String status);

    // ---------------------------------------------------------------------
    // Institute-scoped coupon support (V308 / V309)
    // ---------------------------------------------------------------------

    /**
     * Paged listing for the admin Settings → Coupons page. Filters by institute
     * (PRODUCT_PAGE coupons created before V309 backfill may have null institute_id
     * and won't appear here — V309 fixes this for existing rows; the product-page
     * createCoupon was patched to set it for new rows).
     */
    // NOTE: :search is bound as an empty string (not null) when no search is
    // requested — passing a typeless null into LOWER(CONCAT(…, :search, …))
    // makes Postgres infer bytea and fail with `function lower(bytea) does not
    // exist`. Service layer normalizes accordingly.
    @Query("""
        SELECT c FROM CouponCode c
        WHERE (:instituteId IS NULL OR c.instituteId = :instituteId)
          AND (:statuses IS NULL OR c.status IN :statuses)
          AND (:search = '' OR LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%')))
        """)
    Page<CouponCode> findForAdminList(
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses,
            @Param("search") String search,
            Pageable pageable
    );

    /**
     * Atomic single-statement decrement of usage_limit. Also gates on status='ACTIVE'
     * so an admin-deactivated coupon can't be drained mid-flight. Returns 1 when the
     * coupon had remaining capacity, 0 otherwise. Callers MUST throw and roll back
     * when 0 is returned and usage_limit is not NULL — that is the apply-time
     * race-loss signal. When usage_limit is NULL the service layer skips this call
     * entirely (unlimited coupons).
     */
    @Modifying
    @Query("""
        UPDATE CouponCode c
        SET c.usageLimit = c.usageLimit - 1
        WHERE c.id = :id
          AND c.status = 'ACTIVE'
          AND c.usageLimit IS NOT NULL
          AND c.usageLimit > 0
        """)
    int tryDecrementUsageLimit(@Param("id") String id);

    /**
     * Count successful redemptions for a coupon by joining UserPlan rows that
     * reference any AppliedCouponDiscount tied to this coupon. Used to derive
     * the admin "Usage" column and to decide which fields are frozen on edit.
     *
     * Excludes PAYMENT_FAILED / CANCELED / TERMINATED — those rows represent
     * coupons that were consumed at enroll time but never resulted in a
     * paid/active membership, so they shouldn't count against the admin's
     * "Usage" column or freeze discount edits. (NB: the underlying
     * usage_limit was still decremented at enroll for those attempts; this
     * count is the *user-facing* tally, not the raw decrement count.)
     */
    @Query("""
        SELECT COUNT(up)
        FROM UserPlan up
        WHERE up.appliedCouponDiscount.couponCode.id = :couponId
          AND up.status NOT IN ('PAYMENT_FAILED', 'CANCELED', 'TERMINATED')
        """)
    long countRedemptions(@Param("couponId") String couponId);
}
