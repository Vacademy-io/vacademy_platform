package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.dto.*;
import vacademy.io.admin_core_service.features.live_session.entity.BookingType;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.service.BookingManagementService;
import vacademy.io.admin_core_service.features.live_session.service.LiveSessionBookingService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/admin-core-service/booking/v1")
@RequiredArgsConstructor
public class BookingController {

    private final BookingManagementService bookingManagementService;
    private final LiveSessionBookingService liveSessionBookingService;

    // ==================== CREATE BOOKING ====================

    @PostMapping("/create")
    public ResponseEntity<LiveSession> createBooking(
            @RequestBody CreateBookingRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(liveSessionBookingService.createBooking(request, user));
    }

    // ==================== LINK USERS TO BOOKING ====================

    @PostMapping("/link-users")
    public ResponseEntity<String> linkUsersToBooking(
            @RequestBody LinkUsersToBookingRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(liveSessionBookingService.linkUsersToBooking(
                request.getSessionId(),
                request.getUserIds(),
                request.getRemoveUserIds(),
                user));
    }

    // ==================== CHECK AVAILABILITY ====================

    @PostMapping("/check-availability")
    public ResponseEntity<CheckAvailabilityResponse> checkAvailability(
            @RequestBody CheckAvailabilityRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.checkAvailability(request));
    }

    // ==================== CANCEL BOOKING ====================

    @PostMapping("/cancel")
    public ResponseEntity<String> cancelBooking(
            @RequestBody CancelBookingRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.cancelBooking(request, user));
    }

    // ==================== RESCHEDULE BOOKING ====================

    @PostMapping("/reschedule")
    public ResponseEntity<String> rescheduleBooking(
            @RequestBody RescheduleBookingRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.rescheduleBooking(request, user));
    }

    // ==================== GET USER CALENDAR ====================

    @GetMapping("/calendar")
    public ResponseEntity<List<CalendarEventDTO>> getUserCalendar(
            @RequestParam("userId") String userId,
            @RequestParam("startDate") String startDate,
            @RequestParam("endDate") String endDate,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.getUserCalendar(
                userId,
                LocalDate.parse(startDate),
                LocalDate.parse(endDate)));
    }

    // ==================== GET BOOKING BY ID ====================

    @GetMapping("/{sessionId}")
    public ResponseEntity<BookingDetailDTO> getBookingById(
            @PathVariable("sessionId") String sessionId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.getBookingById(sessionId));
    }

    // ==================== UPDATE BOOKING STATUS ====================

    @PatchMapping("/{sessionId}/status")
    public ResponseEntity<String> updateBookingStatus(
            @PathVariable("sessionId") String sessionId,
            @RequestBody UpdateBookingStatusRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.updateBookingStatus(sessionId, request, user));
    }

    // ==================== BOOKING TYPE CRUD ====================

    @PostMapping("/types/create")
    public ResponseEntity<BookingType> createBookingType(
            @RequestBody BookingTypeDTO dto,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.createBookingType(dto));
    }

    @PutMapping("/types/{id}")
    public ResponseEntity<BookingType> updateBookingType(
            @PathVariable("id") String id,
            @RequestBody BookingTypeDTO dto,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.updateBookingType(id, dto));
    }

    @DeleteMapping("/types/{id}")
    public ResponseEntity<String> deleteBookingType(
            @PathVariable("id") String id,
            @RequestAttribute("user") CustomUserDetails user) {
        bookingManagementService.deleteBookingType(id);
        return ResponseEntity.ok("Booking type deleted successfully");
    }

    @GetMapping("/types/list")
    public ResponseEntity<Page<BookingType>> getBookingTypes(
            @RequestParam("instituteId") String instituteId,
            Pageable pageable,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.getBookingTypes(instituteId, pageable));
    }

    /**
     * Get all booking types (for super admin, no institute filter)
     */
    @GetMapping("/types/all")
    public ResponseEntity<Page<BookingType>> getAllBookingTypes(
            Pageable pageable,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.getAllBookingTypes(pageable));
    }

    /**
     * Get only global booking types (institute_id is null)
     */
    @GetMapping("/types/global")
    public ResponseEntity<Page<BookingType>> getGlobalBookingTypes(
            Pageable pageable,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.getGlobalBookingTypes(pageable));
    }

    /**
     * Get only institute-specific booking types
     */
    @GetMapping("/types/by-institute")
    public ResponseEntity<Page<BookingType>> getInstituteBookingTypes(
            @RequestParam("instituteId") String instituteId,
            Pageable pageable,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(bookingManagementService.getInstituteBookingTypes(instituteId, pageable));
    }
}
