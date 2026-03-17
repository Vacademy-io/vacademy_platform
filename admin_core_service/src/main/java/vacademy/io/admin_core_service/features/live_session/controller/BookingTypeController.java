package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.entity.BookingType;
import vacademy.io.admin_core_service.features.live_session.service.BookingTypeService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * @deprecated Use BookingController /admin-core-service/booking/v1/types/*
 *             endpoints instead.
 *             This controller is kept for backward compatibility.
 */
@RestController
@RequestMapping("/admin-core-service/booking-types/v1")
@RequiredArgsConstructor
@Deprecated
public class BookingTypeController {

    private final BookingTypeService bookingTypeService;

    @GetMapping("/list")
    public ResponseEntity<Page<BookingType>> getBookingTypes(
            @RequestParam("instituteId") String instituteId,
            Pageable pageable,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingTypeService.getBookingTypesForInstitute(instituteId, pageable));
    }
}
