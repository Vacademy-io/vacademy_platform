package vacademy.io.admin_core_service.features.booking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;

import java.sql.Timestamp;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingInstanceRepository extends JpaRepository<BookingInstance, String> {

    Optional<BookingInstance> findByManageToken(String manageToken);

    /** Public-endpoint abuse caps (see PublicBookingService.book). */
    long countByBookingPageIdAndCreatedAtAfter(String bookingPageId, Timestamp after);

    long countByBookingPageIdAndInviteeEmailIgnoreCaseAndCreatedAtAfter(
            String bookingPageId, String inviteeEmail, Timestamp after);

    Optional<BookingInstance> findByLiveSessionId(String liveSessionId);

    List<BookingInstance> findByAudienceResponseId(String audienceResponseId);

    /** Active (non-cancelled) bookings of one host overlapping a window — slot blocking. */
    @Query("""
            SELECT b FROM BookingInstance b
            WHERE b.hostUserId = :hostUserId
              AND b.status NOT IN ('CANCELLED', 'RESCHEDULED')
              AND b.scheduledStartUtc < :windowEnd
              AND b.scheduledEndUtc > :windowStart
            """)
    List<BookingInstance> findActiveOverlapping(
            @Param("hostUserId") String hostUserId,
            @Param("windowStart") Timestamp windowStart,
            @Param("windowEnd") Timestamp windowEnd);

    /** All bookings of an institute inside a window — Team Meetings for admins. */
    @Query("""
            SELECT b FROM BookingInstance b
            WHERE b.instituteId = :instituteId
              AND b.scheduledStartUtc < :windowEnd
              AND b.scheduledEndUtc > :windowStart
            ORDER BY b.scheduledStartUtc ASC
            """)
    List<BookingInstance> findForInstituteInWindow(
            @Param("instituteId") String instituteId,
            @Param("windowStart") Timestamp windowStart,
            @Param("windowEnd") Timestamp windowEnd);

    /** Bookings of a set of hosts inside a window — My Schedule / Team Meetings. */
    @Query("""
            SELECT b FROM BookingInstance b
            WHERE b.instituteId = :instituteId
              AND b.hostUserId IN :hostUserIds
              AND b.scheduledStartUtc < :windowEnd
              AND b.scheduledEndUtc > :windowStart
            ORDER BY b.scheduledStartUtc ASC
            """)
    List<BookingInstance> findForHostsInWindow(
            @Param("instituteId") String instituteId,
            @Param("hostUserIds") Collection<String> hostUserIds,
            @Param("windowStart") Timestamp windowStart,
            @Param("windowEnd") Timestamp windowEnd);
}
