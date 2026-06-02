package vacademy.io.admin_core_service.features.user_subscription.service.coupon;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.AppliedDiscountInputDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponCreateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponDetailResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.coupon.CouponUpdateRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponPackageSession;
import vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponCodeRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponEnrollInviteRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.CouponPackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the admin CRUD service — discount validation, uniqueness handling
 * (incl. TOCTOU race), edit-after-redemption freeze rules, scope replacement,
 * and the soft-delete tenant guard.
 */
@ExtendWith(MockitoExtension.class)
class CouponManagementServiceTest {

    private static final String INSTITUTE_ID = "inst-1";
    private static final String OTHER_INSTITUTE_ID = "inst-2";

    @Mock
    private CouponCodeRepository couponCodeRepository;

    @Mock
    private AppliedCouponDiscountRepository appliedCouponDiscountRepository;

    @Mock
    private CouponPackageSessionRepository couponPackageSessionRepository;

    @Mock
    private CouponEnrollInviteRepository couponEnrollInviteRepository;

    @InjectMocks
    private CouponManagementService service;

    private CouponCreateRequestDTO validCreateRequest() {
        return CouponCreateRequestDTO.builder()
                .code("save20")
                .redeemEndDate(new Date(System.currentTimeMillis() + 86_400_000))
                .usageLimit(100L)
                .appliedDiscount(AppliedDiscountInputDTO.builder()
                        .discountType("PERCENTAGE")
                        .discountPoint(20.0)
                        .maxDiscountPoint(500.0)
                        .build())
                .build();
    }

    private CouponCode existingCoupon(String id, long redemptions) {
        CouponCode c = new CouponCode();
        c.setId(id);
        c.setCode("SAVE20");
        c.setStatus("ACTIVE");
        c.setInstituteId(INSTITUTE_ID);
        c.setRedeemEndDate(new Date(System.currentTimeMillis() + 86_400_000));
        c.setUsageLimit(100L);
        // The service calls countRedemptions; we'll stub per-test.
        return c;
    }

    private void stubSaveAndFlushEcho() {
        when(couponCodeRepository.saveAndFlush(any(CouponCode.class)))
                .thenAnswer(inv -> {
                    CouponCode c = inv.getArgument(0);
                    if (c.getId() == null) c.setId("new-coupon-id");
                    return c;
                });
        when(appliedCouponDiscountRepository.save(any(AppliedCouponDiscount.class)))
                .thenAnswer(inv -> {
                    AppliedCouponDiscount d = inv.getArgument(0);
                    if (d.getId() == null) d.setId("new-discount-id");
                    return d;
                });
    }

    // ---------------------------------------------------------------
    // create()
    // ---------------------------------------------------------------

    @Nested
    @DisplayName("create()")
    class Create {

        @Test
        @DisplayName("Rejects when instituteId is blank")
        void rejectsBlankInstitute() {
            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.create("", validCreateRequest()));
            assertTrue(ex.getMessage().contains("instituteId"));
        }

        @Test
        @DisplayName("Rejects when (institute, code) already exists")
        void rejectsDuplicateCode() {
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.of(new CouponCode()));

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.create(INSTITUTE_ID, validCreateRequest()));
            assertTrue(ex.getMessage().contains("already exists"));
            verify(couponCodeRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("TOCTOU race: passes uniqueness check, DB constraint fires → clean error")
        void tocouRace() {
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.empty());
            when(couponCodeRepository.saveAndFlush(any(CouponCode.class)))
                    .thenThrow(new DataIntegrityViolationException("uq_coupon_code_institute_code"));

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.create(INSTITUTE_ID, validCreateRequest()));
            assertTrue(ex.getMessage().contains("already exists"));
            verify(appliedCouponDiscountRepository, never()).save(any());
        }

        @Test
        @DisplayName("PERCENTAGE > 100 rejected")
        void rejectsPercentageOverHundred() {
            CouponCreateRequestDTO req = validCreateRequest();
            req.getAppliedDiscount().setDiscountPoint(150.0);
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.empty());

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.create(INSTITUTE_ID, req));
            assertTrue(ex.getMessage().contains("100"));
        }

        @Test
        @DisplayName("PERCENTAGE without maxDiscountPoint rejected")
        void rejectsPercentageWithoutCap() {
            CouponCreateRequestDTO req = validCreateRequest();
            req.getAppliedDiscount().setMaxDiscountPoint(null);
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.empty());

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.create(INSTITUTE_ID, req));
            assertTrue(ex.getMessage().contains("maxDiscountPoint"));
        }

        @Test
        @DisplayName("Invalid discount type rejected")
        void rejectsInvalidDiscountType() {
            CouponCreateRequestDTO req = validCreateRequest();
            req.getAppliedDiscount().setDiscountType("WEIRD");
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.empty());

            assertThrows(VacademyException.class, () -> service.create(INSTITUTE_ID, req));
        }

        @Test
        @DisplayName("redeemEndDate < redeemStartDate rejected")
        void rejectsBackwardsValidity() {
            CouponCreateRequestDTO req = validCreateRequest();
            req.setRedeemStartDate(new Date(System.currentTimeMillis() + 86_400_000));
            req.setRedeemEndDate(new Date(System.currentTimeMillis() - 86_400_000));
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.empty());

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.create(INSTITUTE_ID, req));
            assertTrue(ex.getMessage().toLowerCase().contains("redeemenddate"));
        }

        @Test
        @DisplayName("Successful create persists coupon + discount + scope rows")
        void createPersistsHierarchy() {
            when(couponCodeRepository.findByInstituteIdAndCodeAndStatusNot(INSTITUTE_ID, "SAVE20", "DELETED"))
                    .thenReturn(Optional.empty());
            stubSaveAndFlushEcho();

            CouponCreateRequestDTO req = validCreateRequest();
            req.setApplicablePackageSessionIds(List.of("ps-1", "ps-2"));

            CouponDetailResponseDTO resp = service.create(INSTITUTE_ID, req);

            assertNotNull(resp.getId());

            ArgumentCaptor<CouponCode> couponCaptor = ArgumentCaptor.forClass(CouponCode.class);
            verify(couponCodeRepository).saveAndFlush(couponCaptor.capture());
            CouponCode savedCoupon = couponCaptor.getValue();
            assertEquals("SAVE20", savedCoupon.getCode()); // upper-cased
            assertEquals("INSTITUTE", savedCoupon.getSourceType());
            assertEquals(INSTITUTE_ID, savedCoupon.getInstituteId());
            assertEquals("ACTIVE", savedCoupon.getStatus());

            ArgumentCaptor<AppliedCouponDiscount> discountCaptor = ArgumentCaptor.forClass(AppliedCouponDiscount.class);
            verify(appliedCouponDiscountRepository).save(discountCaptor.capture());
            AppliedCouponDiscount savedDiscount = discountCaptor.getValue();
            assertEquals("PERCENTAGE", savedDiscount.getDiscountType());
            assertEquals("COUPON_CODE", savedDiscount.getDiscountSource());

            // Two PS scope rows persisted
            verify(couponPackageSessionRepository).deleteByCouponCodeId(anyString());
            verify(couponPackageSessionRepository, times(2)).save(any(CouponPackageSession.class));
            verify(couponEnrollInviteRepository, never()).deleteByCouponCodeId(anyString());
        }
    }

    // ---------------------------------------------------------------
    // update() freeze rules
    // ---------------------------------------------------------------

    @Nested
    @DisplayName("update() — freeze rules")
    class Update {

        @Test
        @DisplayName("Cannot update other institute's coupon")
        void crossInstituteBlocked() {
            CouponCode c = existingCoupon("c-1", 0);
            c.setInstituteId(OTHER_INSTITUTE_ID);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.update(INSTITUTE_ID, "c-1", new CouponUpdateRequestDTO()));
            assertTrue(ex.getMessage().contains("does not belong"));
        }

        @Test
        @DisplayName("redeemEndDate can be extended after redemption")
        void canExtendEndDate() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(5L);
            when(couponCodeRepository.save(any(CouponCode.class))).thenAnswer(inv -> inv.getArgument(0));

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            req.setRedeemEndDate(new Date(System.currentTimeMillis() + 86_400_000L * 30));

            service.update(INSTITUTE_ID, "c-1", req);

            verify(couponCodeRepository).save(any(CouponCode.class));
        }

        @Test
        @DisplayName("redeemEndDate cannot be shortened after redemption")
        void cannotShortenEndDate() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(5L);

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            // Earlier than the existing redeemEndDate set by existingCoupon
            req.setRedeemEndDate(new Date(System.currentTimeMillis() + 3_600_000)); // 1h

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.update(INSTITUTE_ID, "c-1", req));
            assertTrue(ex.getMessage().toLowerCase().contains("extended"));
        }

        @Test
        @DisplayName("usageLimit can be increased after redemption")
        void canIncreaseUsageLimit() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(5L);
            when(couponCodeRepository.save(any(CouponCode.class))).thenAnswer(inv -> inv.getArgument(0));

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            req.setUsageLimit(200L);

            service.update(INSTITUTE_ID, "c-1", req);

            verify(couponCodeRepository).save(any(CouponCode.class));
        }

        @Test
        @DisplayName("usageLimit cannot be decreased after redemption")
        void cannotDecreaseUsageLimit() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(5L);

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            req.setUsageLimit(50L);

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.update(INSTITUTE_ID, "c-1", req));
            assertTrue(ex.getMessage().toLowerCase().contains("increased"));
        }

        @Test
        @DisplayName("Discount fields are frozen after first redemption")
        void discountFrozenAfterRedemption() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(1L);
            when(couponCodeRepository.save(any(CouponCode.class))).thenAnswer(inv -> inv.getArgument(0));

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            req.setAppliedDiscount(AppliedDiscountInputDTO.builder()
                    .discountType("PERCENTAGE")
                    .discountPoint(30.0)
                    .maxDiscountPoint(1000.0)
                    .build());

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.update(INSTITUTE_ID, "c-1", req));
            assertTrue(ex.getMessage().toLowerCase().contains("frozen"));
        }

        @Test
        @DisplayName("Scope is frozen after first redemption")
        void scopeFrozenAfterRedemption() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(1L);
            when(couponCodeRepository.save(any(CouponCode.class))).thenAnswer(inv -> inv.getArgument(0));

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            req.setApplicablePackageSessionIds(List.of("ps-new"));

            VacademyException ex = assertThrows(VacademyException.class,
                    () -> service.update(INSTITUTE_ID, "c-1", req));
            assertTrue(ex.getMessage().toLowerCase().contains("frozen"));
        }

        @Test
        @DisplayName("Pre-redemption: discount + scope can both be replaced")
        void preRedemptionAllowsFullEdit() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));
            when(couponCodeRepository.countRedemptions("c-1")).thenReturn(0L);
            when(couponCodeRepository.save(any(CouponCode.class))).thenAnswer(inv -> inv.getArgument(0));
            when(appliedCouponDiscountRepository
                    .findFirstByCouponCode_IdAndStatusOrderByCreatedAtDesc(eq("c-1"), anyString()))
                    .thenReturn(Optional.empty());
            when(appliedCouponDiscountRepository.save(any(AppliedCouponDiscount.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            CouponUpdateRequestDTO req = new CouponUpdateRequestDTO();
            req.setAppliedDiscount(AppliedDiscountInputDTO.builder()
                    .discountType("FLAT")
                    .discountPoint(200.0)
                    .build());
            req.setApplicablePackageSessionIds(List.of("ps-2"));

            service.update(INSTITUTE_ID, "c-1", req);

            verify(appliedCouponDiscountRepository).save(any());
            verify(couponPackageSessionRepository).deleteByCouponCodeId("c-1");
        }
    }

    // ---------------------------------------------------------------
    // softDelete()
    // ---------------------------------------------------------------

    @Nested
    @DisplayName("softDelete()")
    class SoftDelete {

        @Test
        @DisplayName("Sets status to DELETED on owned coupon")
        void softDeletes() {
            CouponCode c = existingCoupon("c-1", 0);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));

            service.softDelete(INSTITUTE_ID, "c-1");

            ArgumentCaptor<CouponCode> captor = ArgumentCaptor.forClass(CouponCode.class);
            verify(couponCodeRepository).save(captor.capture());
            assertEquals("DELETED", captor.getValue().getStatus());
        }

        @Test
        @DisplayName("Rejects cross-institute delete")
        void blocksCrossInstitute() {
            CouponCode c = existingCoupon("c-1", 0);
            c.setInstituteId(OTHER_INSTITUTE_ID);
            when(couponCodeRepository.findById("c-1")).thenReturn(Optional.of(c));

            assertThrows(VacademyException.class,
                    () -> service.softDelete(INSTITUTE_ID, "c-1"));
            verify(couponCodeRepository, never()).save(any());
        }
    }

    // ---------------------------------------------------------------
    // list()
    // ---------------------------------------------------------------

    @Nested
    @DisplayName("list()")
    class ListCoupons {

        @Test
        @DisplayName("Rejects blank instituteId")
        void rejectsBlankInstitute() {
            assertThrows(VacademyException.class,
                    () -> service.list("", List.of("ACTIVE"), null, 0, 20));
        }
    }
}
