package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.CreateBookingRequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.service.LiveSessionBookingService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/live-sessions/v1/booking")
@RequiredArgsConstructor
public class LiveSessionBookingController {

    private final LiveSessionBookingService bookingService;

    @PostMapping("/create")
    public ResponseEntity<LiveSession> createBooking(
            @RequestBody CreateBookingRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingService.createBooking(request, user));
    }
}
