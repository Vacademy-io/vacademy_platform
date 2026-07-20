package vacademy.io.admin_core_service.features.booking.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.booking.dto.PublicBookingDTOs;
import vacademy.io.admin_core_service.features.booking.service.PublicBookingService;

/**
 * Unauthenticated public booking surface (covered by the
 * {@code /admin-core-service/open/**} permitAll rule). Slug is scoped by
 * institute (slugs are unique per institute, not globally); invitee
 * self-service is gated by the opaque per-booking manage token.
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/booking")
@RequiredArgsConstructor
public class PublicBookingController {

    private final PublicBookingService publicBookingService;

    @GetMapping("/page/{instituteId}/{slug}")
    public ResponseEntity<PublicBookingDTOs.PublicPageDTO> getPage(
            @PathVariable("instituteId") String instituteId,
            @PathVariable("slug") String slug) {
        return ResponseEntity.ok(publicBookingService.getPage(instituteId, slug));
    }

    @GetMapping("/page/{instituteId}/{slug}/slots")
    public ResponseEntity<PublicBookingDTOs.SlotsResponseDTO> getSlots(
            @PathVariable("instituteId") String instituteId,
            @PathVariable("slug") String slug,
            @RequestParam("from") String from,
            @RequestParam("to") String to,
            @RequestParam(value = "tz", required = false) String tz) {
        return ResponseEntity.ok(publicBookingService.getSlots(instituteId, slug, from, to, tz));
    }

    @PostMapping("/page/{instituteId}/{slug}/book")
    public ResponseEntity<PublicBookingDTOs.PublicBookingViewDTO> book(
            @PathVariable("instituteId") String instituteId,
            @PathVariable("slug") String slug,
            @RequestBody PublicBookingDTOs.PublicBookRequestDTO request) {
        return ResponseEntity.ok(publicBookingService.book(instituteId, slug, request));
    }

    @GetMapping("/manage/{token}")
    public ResponseEntity<PublicBookingDTOs.PublicBookingViewDTO> getBooking(
            @PathVariable("token") String token) {
        return ResponseEntity.ok(publicBookingService.getByToken(token));
    }

    @PostMapping("/manage/{token}/cancel")
    public ResponseEntity<PublicBookingDTOs.PublicBookingViewDTO> cancel(
            @PathVariable("token") String token,
            @RequestBody(required = false) PublicBookingDTOs.PublicCancelRequestDTO request) {
        return ResponseEntity.ok(publicBookingService.cancel(token, request));
    }

    @PostMapping("/manage/{token}/reschedule")
    public ResponseEntity<PublicBookingDTOs.PublicBookingViewDTO> reschedule(
            @PathVariable("token") String token,
            @RequestBody PublicBookingDTOs.PublicRescheduleRequestDTO request) {
        return ResponseEntity.ok(publicBookingService.reschedule(token, request));
    }
}
