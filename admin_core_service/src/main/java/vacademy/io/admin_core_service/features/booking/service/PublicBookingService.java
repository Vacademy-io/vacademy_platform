package vacademy.io.admin_core_service.features.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.SubmitLeadRequestDTO;
import vacademy.io.admin_core_service.features.audience.service.AudienceService;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.dto.BookingInstanceDTO;
import vacademy.io.admin_core_service.features.booking.dto.MeetingBookingRequestDTO;
import vacademy.io.admin_core_service.features.booking.dto.PublicBookingDTOs;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldTypeEnum;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.live_session.dto.CancelBookingRequest;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.admin_core_service.features.live_session.service.BookingManagementService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Unauthenticated (public link) booking flow: render page, list slots, book,
 * and invitee self-service via the opaque manage token. All writes funnel into
 * {@link MeetingBookingService} with a minimal host principal, so the public
 * path shares the exact create semantics (wall-clock, reminders, Meet link)
 * with the admin path.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicBookingService {

    private static final String SOURCE_TYPE_BOOKING = "AUDIENCE_BOOKING";

    /**
     * Coarse public-endpoint abuse caps: bound confirmation-email blast,
     * host-calendar flooding, Meet-quota spend, and workflow credit burn from
     * the unauthenticated book endpoint. Generous for real traffic.
     */
    private static final int MAX_BOOKINGS_PER_PAGE_PER_DAY = 200;
    private static final int MAX_BOOKINGS_PER_EMAIL_PER_PAGE_PER_DAY = 5;

    private final BookingPageRepository bookingPageRepository;
    private final BookingInstanceRepository bookingInstanceRepository;
    private final BookingPageService bookingPageService;
    private final BookingSlotService bookingSlotService;
    private final MeetingBookingService meetingBookingService;
    private final BookingManagementService bookingManagementService;
    private final ScheduleNotificationRepository scheduleNotificationRepository;
    private final AudienceService audienceService;
    private final AuthService authService;
    private final InstituteCustomFiledService instituteCustomFiledService;

    public PublicBookingDTOs.PublicPageDTO getPage(String instituteId, String slug) {
        BookingPage page = activePage(instituteId, slug);
        return PublicBookingDTOs.PublicPageDTO.builder()
                .slug(page.getSlug())
                .title(page.getTitle())
                .description(page.getDescription())
                .hostName(hostName(page.getHostUserId()))
                .durationMinutes(page.getDurationMinutes())
                .timezone(page.getTimezone())
                .locationType(page.getLocationType())
                .requireApproval(page.getRequireApproval())
                .minNoticeMinutes(page.getMinNoticeMinutes())
                .bookingHorizonDays(page.getBookingHorizonDays())
                .customFields(customFieldsFor(page))
                .build();
    }

    /** Booking-form fields = the linked audience list's campaign custom fields. */
    private java.util.List<vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO>
            customFieldsFor(BookingPage page) {
        if (page.getAudienceId() == null || page.getAudienceId().isBlank()) return List.of();
        try {
            return instituteCustomFiledService.findCustomFieldsAsJson(
                    page.getInstituteId(), CustomFieldTypeEnum.AUDIENCE_FORM.name(), page.getAudienceId());
        } catch (Exception e) {
            log.warn("customFieldsFor page {} failed: {}", page.getId(), e.getMessage());
            return List.of();
        }
    }

    public PublicBookingDTOs.SlotsResponseDTO getSlots(String instituteId, String slug,
                                                       String fromDate, String toDate, String displayTz) {
        BookingPage page = activePage(instituteId, slug);
        LocalDate from;
        LocalDate to;
        try {
            from = LocalDate.parse(fromDate);
            to = LocalDate.parse(toDate);
        } catch (Exception e) {
            throw new VacademyException("from/to must be yyyy-MM-dd");
        }
        ZoneId zone = resolveZone(displayTz, page.getTimezone());
        List<String> slots = bookingSlotService.availableSlots(page, from, to).stream()
                .map(instant -> instant.atZone(zone).toOffsetDateTime()
                        .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .collect(Collectors.toList());
        return PublicBookingDTOs.SlotsResponseDTO.builder()
                .slots(slots)
                .durationMinutes(page.getDurationMinutes())
                .timezone(zone.getId())
                .build();
    }

    public PublicBookingDTOs.PublicBookingViewDTO book(String instituteId, String slug,
                                                       PublicBookingDTOs.PublicBookRequestDTO request) {
        BookingPage page = activePage(instituteId, slug);
        if (request.getName() == null || request.getName().isBlank()) {
            throw new VacademyException("name is required");
        }
        boolean hasEmail = request.getEmail() != null && !request.getEmail().isBlank();
        boolean hasPhone = request.getPhone() != null && !request.getPhone().isBlank();
        if (!hasEmail && !hasPhone) {
            throw new VacademyException("email or phone is required");
        }
        Instant slotStart = parseStart(request.getStartTime());
        if (!bookingSlotService.isSlotAvailable(page, slotStart)) {
            throw new VacademyException("This slot is no longer available. Please pick another time.");
        }
        enforceAbuseCaps(page, hasEmail ? request.getEmail() : null);

        // CRM linkage: a public booking on a list-attached page is a lead.
        // Best effort — a broken audience config must not block the meeting.
        String audienceResponseId = null;
        if (page.getAudienceId() != null && !page.getAudienceId().isBlank()) {
            try {
                SubmitLeadRequestDTO lead = new SubmitLeadRequestDTO();
                lead.setAudienceId(page.getAudienceId());
                lead.setSourceType(SOURCE_TYPE_BOOKING);
                lead.setSourceId(page.getId());
                UserDTO userDTO = new UserDTO();
                userDTO.setFullName(request.getName());
                userDTO.setEmail(hasEmail ? request.getEmail() : null);
                userDTO.setMobileNumber(hasPhone ? request.getPhone() : null);
                lead.setUserDTO(userDTO);
                // Custom-field answers persist against the audience_response via
                // the standard lead pipeline → visible in the CRM lead views.
                if (request.getCustomFieldValues() != null && !request.getCustomFieldValues().isEmpty()) {
                    lead.setCustomFieldValues(request.getCustomFieldValues());
                }
                audienceResponseId = audienceService.submitLead(lead);
            } catch (Exception e) {
                log.error("Lead creation for public booking failed (page {}): {}", page.getId(), e.getMessage());
            }
        }

        MeetingBookingRequestDTO booking = MeetingBookingRequestDTO.builder()
                .instituteId(page.getInstituteId())
                .bookingPageId(page.getId())
                .hostUserId(page.getHostUserId())
                .startTime(request.getStartTime())
                .inviteeName(request.getName())
                .inviteeEmail(hasEmail ? request.getEmail() : null)
                .inviteePhone(hasPhone ? request.getPhone() : null)
                .inviteeTimezone(request.getInviteeTimezone())
                .audienceResponseId(audienceResponseId)
                .customFieldValues(request.getCustomFieldValues())
                .build();
        BookingInstanceDTO created = meetingBookingService.createBooking(booking, hostPrincipal(page));

        BookingInstance instance = bookingInstanceRepository.findById(created.getId())
                .orElseThrow(() -> new VacademyException("Booking not found after create"));
        return toView(instance, page);
    }

    public PublicBookingDTOs.PublicBookingViewDTO getByToken(String manageToken) {
        BookingInstance instance = instanceByToken(manageToken);
        return toView(instance, pageOf(instance));
    }

    @Transactional
    public PublicBookingDTOs.PublicBookingViewDTO cancel(String manageToken,
                                                         PublicBookingDTOs.PublicCancelRequestDTO request) {
        BookingInstance instance = instanceByToken(manageToken);
        assertMutable(instance);
        cancelUnderlying(instance, request != null ? request.getReason() : null);
        return toView(instance, pageOf(instance));
    }

    public PublicBookingDTOs.PublicBookingViewDTO reschedule(String manageToken,
                                                             PublicBookingDTOs.PublicRescheduleRequestDTO request) {
        BookingInstance old = instanceByToken(manageToken);
        assertMutable(old);
        BookingPage page = pageOf(old);
        if (page == null || !"ACTIVE".equals(page.getStatus())) {
            throw new VacademyException("This booking can no longer be rescheduled online.");
        }
        Instant newStart = parseStart(request.getStartTime());
        if (!bookingSlotService.isSlotAvailable(page, newStart)) {
            throw new VacademyException("This slot is no longer available. Please pick another time.");
        }

        // Claim the old instance FIRST (optimistic @Version — a concurrent
        // reschedule/cancel loses here instead of double-booking). If creating
        // the replacement then fails, compensate by restoring the old status.
        String previousStatus = old.getStatus();
        old.setStatus("RESCHEDULED");
        try {
            old = bookingInstanceRepository.saveAndFlush(old);
        } catch (org.springframework.dao.OptimisticLockingFailureException e) {
            throw new VacademyException("This booking was just modified. Please reload and try again.");
        }

        MeetingBookingRequestDTO booking = MeetingBookingRequestDTO.builder()
                .instituteId(old.getInstituteId())
                .bookingPageId(page.getId())
                .hostUserId(old.getHostUserId())
                .startTime(request.getStartTime())
                .inviteeName(old.getInviteeName())
                .inviteeEmail(old.getInviteeEmail())
                .inviteePhone(old.getInviteePhone())
                .inviteeTimezone(request.getInviteeTimezone() != null
                        ? request.getInviteeTimezone() : old.getInviteeTimezone())
                .inviteeUserId(old.getInviteeUserId())
                .audienceResponseId(old.getAudienceResponseId())
                .customFieldValues(parseStoredCustomFields(old.getCustomFieldValuesJson()))
                .build();
        BookingInstanceDTO created;
        try {
            created = meetingBookingService.createBooking(booking, hostPrincipal(page));
        } catch (Exception e) {
            old.setStatus(previousStatus);
            bookingInstanceRepository.save(old);
            throw e;
        }

        // Retire the old occurrence's session + reminders (status already RESCHEDULED).
        cancelUnderlying(old, "Rescheduled by invitee", "RESCHEDULED");

        BookingInstance replacement = bookingInstanceRepository.findById(created.getId())
                .orElseThrow(() -> new VacademyException("Booking not found after reschedule"));
        replacement.setRescheduleOfInstanceId(old.getId());
        replacement = bookingInstanceRepository.save(replacement);
        return toView(replacement, page);
    }

    // ---------- helpers ----------

    /** Cancels the live-session substrate + reminder rows and marks the instance. */
    private void cancelUnderlying(BookingInstance instance, String reason) {
        cancelUnderlying(instance, reason, "CANCELLED");
    }

    private void cancelUnderlying(BookingInstance instance, String reason, String finalStatus) {
        try {
            CancelBookingRequest cancel = new CancelBookingRequest();
            cancel.setSessionId(instance.getLiveSessionId());
            cancel.setReason(reason);
            bookingManagementService.cancelBooking(cancel, null);
        } catch (Exception e) {
            log.error("Cancelling live session {} failed: {}", instance.getLiveSessionId(), e.getMessage());
        }
        try {
            scheduleNotificationRepository.deleteAllBySessionId(instance.getLiveSessionId());
        } catch (Exception e) {
            log.warn("Deleting reminders for session {} failed: {}", instance.getLiveSessionId(), e.getMessage());
        }
        instance.setStatus(finalStatus);
        instance.setCancelReason(reason);
        bookingInstanceRepository.save(instance);
    }

    /** Coarse anti-abuse caps for the unauthenticated book endpoint. */
    private void enforceAbuseCaps(BookingPage page, String inviteeEmail) {
        java.sql.Timestamp dayAgo = java.sql.Timestamp.from(Instant.now().minusSeconds(24 * 3600L));
        long pageCount = bookingInstanceRepository
                .countByBookingPageIdAndCreatedAtAfter(page.getId(), dayAgo);
        if (pageCount >= MAX_BOOKINGS_PER_PAGE_PER_DAY) {
            throw new VacademyException("This booking page is temporarily unavailable. Please try again later.");
        }
        if (inviteeEmail != null && !inviteeEmail.isBlank()) {
            long emailCount = bookingInstanceRepository
                    .countByBookingPageIdAndInviteeEmailIgnoreCaseAndCreatedAtAfter(
                            page.getId(), inviteeEmail, dayAgo);
            if (emailCount >= MAX_BOOKINGS_PER_EMAIL_PER_PAGE_PER_DAY) {
                throw new VacademyException(
                        "Too many bookings for this email today. Please use your existing booking link.");
            }
        }
    }

    private BookingPage activePage(String instituteId, String slug) {
        return bookingPageRepository.findByInstituteIdAndSlugAndStatus(instituteId, slug, "ACTIVE")
                .orElseThrow(() -> new VacademyException("Booking page not found"));
    }

    private BookingInstance instanceByToken(String manageToken) {
        if (manageToken == null || manageToken.isBlank()) {
            throw new VacademyException("Booking not found");
        }
        return bookingInstanceRepository.findByManageToken(manageToken)
                .orElseThrow(() -> new VacademyException("Booking not found"));
    }

    private void assertMutable(BookingInstance instance) {
        if ("CANCELLED".equals(instance.getStatus()) || "RESCHEDULED".equals(instance.getStatus())) {
            throw new VacademyException("This booking has already been " + instance.getStatus().toLowerCase() + ".");
        }
        if (instance.getScheduledStartUtc().toInstant().isBefore(Instant.now())) {
            throw new VacademyException("This booking is in the past.");
        }
    }

    private BookingPage pageOf(BookingInstance instance) {
        if (instance.getBookingPageId() == null) return null;
        return bookingPageRepository.findById(instance.getBookingPageId()).orElse(null);
    }

    /**
     * Minimal principal acting as the page host — the public caller has no JWT.
     * Only {@code userId} is consumed downstream (Step1 created-by stamping).
     */
    private CustomUserDetails hostPrincipal(BookingPage page) {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUserId(page.getHostUserId());
        dto.setUsername("public-booking");
        return new CustomUserDetails(dto);
    }

    private String hostName(String hostUserId) {
        try {
            return authService.getUsersFromAuthServiceByUserIds(List.of(hostUserId)).stream()
                    .findFirst().map(UserDTO::getFullName).orElse(null);
        } catch (Exception e) {
            log.warn("hostName lookup failed: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private static java.util.Map<String, String> parseStoredCustomFields(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, java.util.Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static Instant parseStart(String startTime) {
        try {
            return OffsetDateTime.parse(startTime).toInstant();
        } catch (Exception e) {
            throw new VacademyException("start_time must be an ISO-8601 offset datetime");
        }
    }

    private static ZoneId resolveZone(String requested, String fallback) {
        if (requested != null && !requested.isBlank()) {
            try {
                return ZoneId.of(requested);
            } catch (Exception ignored) {
                // fall through to the page zone
            }
        }
        return ZoneId.of(fallback);
    }

    private PublicBookingDTOs.PublicBookingViewDTO toView(BookingInstance instance, BookingPage page) {
        return PublicBookingDTOs.PublicBookingViewDTO.builder()
                .manageToken(instance.getManageToken())
                .pageSlug(page != null ? page.getSlug() : null)
                .title(page != null ? page.getTitle() : "Meeting")
                .hostName(hostName(instance.getHostUserId()))
                .inviteeName(instance.getInviteeName())
                .inviteeEmail(instance.getInviteeEmail())
                .status(instance.getStatus())
                .meetLink(instance.getMeetLink())
                .startTimeUtc(instance.getScheduledStartUtc().toInstant().toString())
                .endTimeUtc(instance.getScheduledEndUtc().toInstant().toString())
                .inviteeTimezone(instance.getInviteeTimezone())
                .build();
    }
}
