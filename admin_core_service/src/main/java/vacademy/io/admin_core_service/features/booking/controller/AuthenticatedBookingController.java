package vacademy.io.admin_core_service.features.booking.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.booking.dto.PublicBookingDTOs;
import vacademy.io.admin_core_service.features.booking.service.PublicBookingService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Authenticated booking-by-slug — same slot-booking flow as the public link, but
 * the meeting is tied to the caller's user id ({@code invitee_user_id}). Used by a
 * logged-in learner booking an assigned mentor from "My Mentors".
 */
@RestController
@RequestMapping("/admin-core-service/v1/booking")
@RequiredArgsConstructor
public class AuthenticatedBookingController {

    private final PublicBookingService publicBookingService;
    private final InstituteAccessValidator instituteAccessValidator;

    @PostMapping("/book/{instituteId}/{slug}")
    @Auditable(entityType = "BOOKING_INSTANCE", action = "CREATE",
            descriptionExpr = "'learner booked a mentor session'")
    public ResponseEntity<PublicBookingDTOs.PublicBookingViewDTO> book(
            @PathVariable("instituteId") String instituteId,
            @PathVariable("slug") String slug,
            @RequestBody PublicBookingDTOs.PublicBookRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(publicBookingService.book(instituteId, slug, request, user.getUserId()));
    }
}
