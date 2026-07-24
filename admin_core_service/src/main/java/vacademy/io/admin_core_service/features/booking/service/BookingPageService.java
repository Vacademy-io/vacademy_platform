package vacademy.io.admin_core_service.features.booking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.dto.BookingAvailabilityDTO;
import vacademy.io.admin_core_service.features.booking.dto.BookingPageDTO;
import vacademy.io.admin_core_service.features.booking.dto.BookingReminderConfigDTO;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingPageService {

    private static final String DELETED = "DELETED";

    private final BookingPageRepository bookingPageRepository;
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    @Transactional
    public BookingPageDTO create(BookingPageDTO dto, CustomUserDetails user) {
        if (dto.getInstituteId() == null || dto.getInstituteId().isBlank()) {
            throw new VacademyException("institute_id is required");
        }
        if (dto.getTitle() == null || dto.getTitle().isBlank()) {
            throw new VacademyException("title is required");
        }
        String hostUserId = dto.getHostUserId() != null && !dto.getHostUserId().isBlank()
                ? dto.getHostUserId()
                : user.getUserId();

        BookingPage page = BookingPage.builder()
                .instituteId(dto.getInstituteId())
                .audienceId(dto.getAudienceId())
                .hostUserId(hostUserId)
                .bookingTypeId(dto.getBookingTypeId())
                .slug(resolveSlug(dto.getInstituteId(), dto.getSlug(), dto.getTitle()))
                .title(dto.getTitle())
                .description(dto.getDescription())
                .durationMinutes(orDefault(dto.getDurationMinutes(), 30))
                .slotGranularityMinutes(orDefault(dto.getSlotGranularityMinutes(), 30))
                .bufferBeforeMinutes(orDefault(dto.getBufferBeforeMinutes(), 0))
                .bufferAfterMinutes(orDefault(dto.getBufferAfterMinutes(), 0))
                .minNoticeMinutes(orDefault(dto.getMinNoticeMinutes(), 120))
                .bookingHorizonDays(orDefault(dto.getBookingHorizonDays(), 30))
                .timezone(dto.getTimezone() != null && !dto.getTimezone().isBlank()
                        ? dto.getTimezone() : "Asia/Kolkata")
                .locationType(dto.getLocationType() != null ? dto.getLocationType() : "GOOGLE_MEET")
                .customMeetingLink(dto.getCustomMeetingLink())
                .allocateGoogleMeet(Boolean.TRUE.equals(dto.getAllocateGoogleMeet()))
                .requireApproval(Boolean.TRUE.equals(dto.getRequireApproval()))
                .availabilityJson(writeJson(dto.getAvailability()))
                .reminderConfigJson(writeJson(dto.getReminderConfig()))
                .status(dto.getStatus() != null ? dto.getStatus() : "ACTIVE")
                .createdByUserId(user.getUserId())
                .build();

        return toDTO(bookingPageRepository.save(page), null);
    }

    @Transactional
    public BookingPageDTO update(String id, String instituteId, BookingPageDTO dto, CustomUserDetails user) {
        BookingPage page = getOrThrow(id, instituteId);
        if (dto.getTitle() != null) page.setTitle(dto.getTitle());
        if (dto.getDescription() != null) page.setDescription(dto.getDescription());
        // Empty string = explicit detach from the audience list; null = leave unchanged.
        if (dto.getAudienceId() != null) {
            page.setAudienceId(dto.getAudienceId().isBlank() ? null : dto.getAudienceId());
        }
        if (dto.getHostUserId() != null && !dto.getHostUserId().isBlank()) page.setHostUserId(dto.getHostUserId());
        if (dto.getBookingTypeId() != null) page.setBookingTypeId(dto.getBookingTypeId());
        if (dto.getSlug() != null && !dto.getSlug().isBlank() && !dto.getSlug().equals(page.getSlug())) {
            page.setSlug(resolveSlug(page.getInstituteId(), dto.getSlug(), page.getTitle()));
        }
        if (dto.getDurationMinutes() != null) page.setDurationMinutes(dto.getDurationMinutes());
        if (dto.getSlotGranularityMinutes() != null) page.setSlotGranularityMinutes(dto.getSlotGranularityMinutes());
        if (dto.getBufferBeforeMinutes() != null) page.setBufferBeforeMinutes(dto.getBufferBeforeMinutes());
        if (dto.getBufferAfterMinutes() != null) page.setBufferAfterMinutes(dto.getBufferAfterMinutes());
        if (dto.getMinNoticeMinutes() != null) page.setMinNoticeMinutes(dto.getMinNoticeMinutes());
        if (dto.getBookingHorizonDays() != null) page.setBookingHorizonDays(dto.getBookingHorizonDays());
        if (dto.getTimezone() != null && !dto.getTimezone().isBlank()) page.setTimezone(dto.getTimezone());
        if (dto.getLocationType() != null) page.setLocationType(dto.getLocationType());
        if (dto.getCustomMeetingLink() != null) page.setCustomMeetingLink(dto.getCustomMeetingLink());
        if (dto.getAllocateGoogleMeet() != null) page.setAllocateGoogleMeet(dto.getAllocateGoogleMeet());
        if (dto.getRequireApproval() != null) page.setRequireApproval(dto.getRequireApproval());
        if (dto.getAvailability() != null) page.setAvailabilityJson(writeJson(dto.getAvailability()));
        if (dto.getReminderConfig() != null) page.setReminderConfigJson(writeJson(dto.getReminderConfig()));
        if (dto.getStatus() != null) page.setStatus(dto.getStatus());
        return toDTO(bookingPageRepository.save(page), null);
    }

    @Transactional
    public void delete(String id, String instituteId) {
        BookingPage page = getOrThrow(id, instituteId);
        page.setStatus(DELETED);
        bookingPageRepository.save(page);
    }

    public BookingPageDTO getById(String id, String instituteId) {
        return enrichOne(getOrThrow(id, instituteId));
    }

    public List<BookingPageDTO> list(String instituteId, String audienceId, String hostUserId) {
        List<BookingPage> pages;
        if (audienceId != null && !audienceId.isBlank()) {
            pages = bookingPageRepository.findByInstituteIdAndAudienceIdAndStatusNot(instituteId, audienceId, DELETED);
        } else if (hostUserId != null && !hostUserId.isBlank()) {
            pages = bookingPageRepository.findByInstituteIdAndHostUserIdAndStatusNot(instituteId, hostUserId, DELETED);
        } else {
            pages = bookingPageRepository.findByInstituteIdAndStatusNot(instituteId, DELETED);
        }
        Map<String, String> hostNames = hostNamesFor(pages.stream()
                .map(BookingPage::getHostUserId).distinct().collect(Collectors.toList()));
        return pages.stream().map(p -> toDTO(p, hostNames.get(p.getHostUserId()))).collect(Collectors.toList());
    }

    public BookingPage getOrThrow(String id) {
        BookingPage page = bookingPageRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Booking page not found: " + id));
        if (DELETED.equals(page.getStatus())) {
            throw new VacademyException("Booking page not found: " + id);
        }
        return page;
    }

    /** Tenant-scoped lookup: 404s (rather than 403s) on an institute mismatch. */
    public BookingPage getOrThrow(String id, String instituteId) {
        BookingPage page = getOrThrow(id);
        if (instituteId == null || !instituteId.equals(page.getInstituteId())) {
            throw new VacademyException("Booking page not found: " + id);
        }
        return page;
    }

    // ---------- helpers ----------

    private BookingPageDTO enrichOne(BookingPage page) {
        Map<String, String> names = hostNamesFor(List.of(page.getHostUserId()));
        return toDTO(page, names.get(page.getHostUserId()));
    }

    private Map<String, String> hostNamesFor(List<String> userIds) {
        Map<String, String> out = new HashMap<>();
        if (userIds == null || userIds.isEmpty()) return out;
        try {
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(userIds)) {
                if (u.getId() != null) out.put(u.getId(), u.getFullName());
            }
        } catch (Exception e) {
            log.warn("hostNamesFor failed: {}", e.getMessage());
        }
        return out;
    }

    /**
     * Slugify the requested slug (or the title), then ensure per-institute
     * uniqueness by suffixing a short random token on collision.
     */
    private String resolveSlug(String instituteId, String requestedSlug, String title) {
        String base = slugify(requestedSlug != null && !requestedSlug.isBlank() ? requestedSlug : title);
        if (base.isBlank()) base = "meeting";
        String candidate = base;
        while (bookingPageRepository.existsByInstituteIdAndSlugAndStatusNot(instituteId, candidate, DELETED)) {
            candidate = base + "-" + UUID.randomUUID().toString().substring(0, 6);
        }
        return candidate;
    }

    private static String slugify(String input) {
        return input == null ? "" : input.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private static Integer orDefault(Integer value, int fallback) {
        return value != null ? value : fallback;
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new VacademyException("Invalid JSON payload: " + e.getMessage());
        }
    }

    public BookingAvailabilityDTO readAvailability(BookingPage page) {
        return readJson(page.getAvailabilityJson(), BookingAvailabilityDTO.class);
    }

    public BookingReminderConfigDTO readReminderConfig(BookingPage page) {
        return readJson(page.getReminderConfigJson(), BookingReminderConfigDTO.class);
    }

    private <T> T readJson(String json, Class<T> type) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            log.warn("Failed to parse stored JSON as {}: {}", type.getSimpleName(), e.getMessage());
            return null;
        }
    }

    public BookingPageDTO toDTO(BookingPage page, String hostName) {
        return BookingPageDTO.builder()
                .id(page.getId())
                .instituteId(page.getInstituteId())
                .audienceId(page.getAudienceId())
                .hostUserId(page.getHostUserId())
                .hostName(hostName)
                .bookingTypeId(page.getBookingTypeId())
                .slug(page.getSlug())
                .title(page.getTitle())
                .description(page.getDescription())
                .durationMinutes(page.getDurationMinutes())
                .slotGranularityMinutes(page.getSlotGranularityMinutes())
                .bufferBeforeMinutes(page.getBufferBeforeMinutes())
                .bufferAfterMinutes(page.getBufferAfterMinutes())
                .minNoticeMinutes(page.getMinNoticeMinutes())
                .bookingHorizonDays(page.getBookingHorizonDays())
                .timezone(page.getTimezone())
                .locationType(page.getLocationType())
                .customMeetingLink(page.getCustomMeetingLink())
                .allocateGoogleMeet(page.getAllocateGoogleMeet())
                .requireApproval(page.getRequireApproval())
                .availability(readAvailability(page))
                .reminderConfig(readReminderConfig(page))
                .status(page.getStatus())
                .createdByUserId(page.getCreatedByUserId())
                .createdAt(page.getCreatedAt())
                .updatedAt(page.getUpdatedAt())
                .build();
    }
}
