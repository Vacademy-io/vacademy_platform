package vacademy.io.admin_core_service.features.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.booking.dto.BookingAvailabilityDTO;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Expands a booking page's availability rules into bookable slot starts.
 *
 * All window math runs in the PAGE timezone; results are instants the caller
 * formats into the invitee's zone. Conflicts are checked against the host's
 * other active booking_instances (expanded by the page buffers). Bookings the
 * host has outside this feature (live classes, ad-hoc calendar events) are NOT
 * consulted in v1.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BookingSlotService {

    private static final int MAX_RANGE_DAYS = 62;

    private final BookingInstanceRepository bookingInstanceRepository;
    private final BookingPageService bookingPageService;

    /** Bookable slot-start instants for [fromDate, toDate] (dates in page tz, inclusive). */
    public List<Instant> availableSlots(BookingPage page, LocalDate fromDate, LocalDate toDate) {
        ZoneId pageZone = ZoneId.of(page.getTimezone());
        Instant now = Instant.now();

        int duration = page.getDurationMinutes() != null ? page.getDurationMinutes() : 30;
        int granularity = page.getSlotGranularityMinutes() != null && page.getSlotGranularityMinutes() > 0
                ? page.getSlotGranularityMinutes() : duration;
        int minNotice = page.getMinNoticeMinutes() != null ? page.getMinNoticeMinutes() : 0;
        int horizonDays = page.getBookingHorizonDays() != null ? page.getBookingHorizonDays() : 30;
        int bufferBefore = page.getBufferBeforeMinutes() != null ? page.getBufferBeforeMinutes() : 0;
        int bufferAfter = page.getBufferAfterMinutes() != null ? page.getBufferAfterMinutes() : 0;

        Instant earliest = now.plusSeconds(minNotice * 60L);
        Instant latest = now.plus(java.time.Duration.ofDays(horizonDays));

        if (toDate.isBefore(fromDate)) return List.of();
        if (toDate.isAfter(fromDate.plusDays(MAX_RANGE_DAYS))) {
            toDate = fromDate.plusDays(MAX_RANGE_DAYS);
        }

        BookingAvailabilityDTO availability = bookingPageService.readAvailability(page);
        if (availability == null || availability.getWeeklyWindows() == null
                || availability.getWeeklyWindows().isEmpty()) {
            return List.of(); // no availability configured = nothing bookable
        }
        Map<DayOfWeek, List<BookingAvailabilityDTO.WeeklyWindow>> weekly = availability.getWeeklyWindows().stream()
                .filter(w -> parseDay(w.getDayOfWeek()) != null)
                .collect(Collectors.groupingBy(w -> parseDay(w.getDayOfWeek())));
        Map<String, BookingAvailabilityDTO.DateOverride> overrides = availability.getDateOverrides() == null
                ? Map.of()
                : availability.getDateOverrides().stream()
                        .filter(o -> o.getDate() != null)
                        .collect(Collectors.toMap(BookingAvailabilityDTO.DateOverride::getDate, o -> o, (a, b) -> b));

        // Existing bookings of the host across the whole range, expanded by buffers.
        Instant rangeStart = fromDate.atStartOfDay(pageZone).toInstant();
        Instant rangeEnd = toDate.plusDays(1).atStartOfDay(pageZone).toInstant();
        List<Instant[]> busy = bookingInstanceRepository.findActiveOverlapping(
                        page.getHostUserId(),
                        Timestamp.from(rangeStart.minusSeconds(3600L * 24)),
                        Timestamp.from(rangeEnd.plusSeconds(3600L * 24))).stream()
                .map(b -> new Instant[]{
                        b.getScheduledStartUtc().toInstant().minusSeconds(bufferBefore * 60L),
                        b.getScheduledEndUtc().toInstant().plusSeconds(bufferAfter * 60L)})
                .collect(Collectors.toList());

        List<Instant> out = new ArrayList<>();
        for (LocalDate date = fromDate; !date.isAfter(toDate); date = date.plusDays(1)) {
            List<BookingAvailabilityDTO.WeeklyWindow> windows = windowsFor(date, weekly, overrides);
            for (BookingAvailabilityDTO.WeeklyWindow window : windows) {
                LocalTime windowStart = parseTime(window.getStartTime());
                LocalTime windowEnd = parseTime(window.getEndTime());
                if (windowStart == null || windowEnd == null || !windowStart.isBefore(windowEnd)) continue;

                ZonedDateTime cursor = date.atTime(windowStart).atZone(pageZone);
                ZonedDateTime windowEndZdt = date.atTime(windowEnd).atZone(pageZone);
                while (!cursor.plusMinutes(duration).isAfter(windowEndZdt)) {
                    Instant slotStart = cursor.toInstant();
                    Instant slotEnd = slotStart.plusSeconds(duration * 60L);
                    if (!slotStart.isBefore(earliest) && !slotStart.isAfter(latest)
                            && !overlapsAny(slotStart, slotEnd, busy)) {
                        out.add(slotStart);
                    }
                    cursor = cursor.plusMinutes(granularity);
                }
            }
        }
        return out;
    }

    /** Is this exact instant a currently-bookable slot start? (Race-window guard, not a lock.) */
    public boolean isSlotAvailable(BookingPage page, Instant slotStart) {
        ZoneId pageZone = ZoneId.of(page.getTimezone());
        LocalDate day = slotStart.atZone(pageZone).toLocalDate();
        return availableSlots(page, day, day).contains(slotStart);
    }

    // ---------- helpers ----------

    private static List<BookingAvailabilityDTO.WeeklyWindow> windowsFor(
            LocalDate date,
            Map<DayOfWeek, List<BookingAvailabilityDTO.WeeklyWindow>> weekly,
            Map<String, BookingAvailabilityDTO.DateOverride> overrides) {
        BookingAvailabilityDTO.DateOverride override = overrides.get(date.toString());
        if (override != null) {
            if (Boolean.TRUE.equals(override.getBlocked())) return List.of();
            if (override.getWindows() != null && !override.getWindows().isEmpty()) return override.getWindows();
            return List.of();
        }
        return weekly.getOrDefault(date.getDayOfWeek(), List.of());
    }

    private static boolean overlapsAny(Instant start, Instant end, List<Instant[]> busy) {
        for (Instant[] b : busy) {
            if (start.isBefore(b[1]) && end.isAfter(b[0])) return true;
        }
        return false;
    }

    private static DayOfWeek parseDay(String value) {
        if (value == null) return null;
        try {
            return DayOfWeek.valueOf(value.trim().toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }

    private static LocalTime parseTime(String value) {
        if (value == null) return null;
        try {
            return LocalTime.parse(value.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
