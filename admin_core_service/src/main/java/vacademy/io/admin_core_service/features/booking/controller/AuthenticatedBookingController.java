package vacademy.io.admin_core_service.features.booking.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.dto.PublicBookingDTOs;
import vacademy.io.admin_core_service.features.booking.service.PublicBookingService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;

/**
 * Authenticated booking-by-slug — same slot-booking flow as the public link, but
 * the meeting is tied to the caller's user id ({@code invitee_user_id}). Used by a
 * logged-in learner booking an assigned mentor from "My Mentors".
 */
@RestController
@RequestMapping("/admin-core-service/v1/booking")
@RequiredArgsConstructor
@Slf4j
public class AuthenticatedBookingController {

    private final PublicBookingService publicBookingService;
    private final InstituteAccessValidator instituteAccessValidator;
    private final AuthService authService;

    /**
     * Book a slot as the logged-in caller.
     *
     * <p>Name, email and phone are optional here and filled in from the caller's own
     * account when omitted. A signed-in learner has already told us who they are, so
     * asking them to retype it on the booking form was pure friction — and a typo'd
     * email meant the confirmation went nowhere. The public endpoint still requires
     * them, because there it is the only identity available.
     */
    @PostMapping("/book/{instituteId}/{slug}")
    @Auditable(entityType = "BOOKING_INSTANCE", action = "CREATE",
            descriptionExpr = "'learner booked a mentor session'")
    public ResponseEntity<PublicBookingDTOs.PublicBookingViewDTO> book(
            @PathVariable("instituteId") String instituteId,
            @PathVariable("slug") String slug,
            @RequestBody PublicBookingDTOs.PublicBookRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        fillFromAccount(request, user);
        return ResponseEntity.ok(publicBookingService.book(instituteId, slug, request, user.getUserId()));
    }

    /**
     * Fill any invitee field the client left blank from the caller's account. Values the
     * client did send always win — a learner booking with a different contact address is
     * a deliberate choice, not something to overwrite.
     */
    private void fillFromAccount(PublicBookingDTOs.PublicBookRequestDTO request, CustomUserDetails user) {
        if (request == null) return;
        if (notBlank(request.getName()) && (notBlank(request.getEmail()) || notBlank(request.getPhone()))) {
            return;
        }
        UserDTO account = lookup(user.getUserId());
        if (!notBlank(request.getName())) {
            String name = account == null ? null : firstNonBlank(account.getFullName(), account.getUsername());
            // The token's own full name is the last resort: a user-details lookup can fail,
            // but the caller is authenticated either way, so the booking should still go through.
            request.setName(firstNonBlank(name, user.getFullName()));
        }
        if (!notBlank(request.getEmail()) && account != null) request.setEmail(account.getEmail());
        if (!notBlank(request.getPhone()) && account != null) request.setPhone(account.getMobileNumber());
    }

    private UserDTO lookup(String userId) {
        if (!notBlank(userId)) return null;
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(List.of(userId)));
            return users == null || users.isEmpty() ? null : users.get(0);
        } catch (Exception e) {
            log.warn("Could not resolve booking invitee {} from auth service: {}", userId, e.getMessage());
            return null;
        }
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }

    private static String firstNonBlank(String a, String b) {
        if (notBlank(a)) return a;
        return notBlank(b) ? b : null;
    }
}
