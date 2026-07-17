package vacademy.io.community_service.feature.support.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.support.entity.SupportTicket;
import vacademy.io.community_service.feature.support.enums.TicketStatus;

import java.util.Collection;
import java.util.Date;

@Repository
public interface SupportTicketRepository extends JpaRepository<SupportTicket, String> {

    // ---- Institute (admin) facing ------------------------------------------------
    // NOTE: every institute-facing read MUST exclude internal-only tickets — those are
    // support-team scratch work the client must never see.

    Page<SupportTicket> findByInstituteIdAndInternalOnlyFalseOrderByLastMessageAtDesc(
            String instituteId, Pageable pageable);

    Page<SupportTicket> findByInstituteIdAndStatusAndInternalOnlyFalseOrderByLastMessageAtDesc(
            String instituteId, TicketStatus status, Pageable pageable);

    long countByInstituteIdAndStatusInAndInternalOnlyFalse(String instituteId,
                                                           Collection<TicketStatus> statuses);

    /** Includes internal-only tickets — super-admin views only, never the institute's own. */
    long countByInstituteIdAndStatusIn(String instituteId, Collection<TicketStatus> statuses);

    // ---- Super-admin (console) facing --------------------------------------------

    /**
     * Inbox search with optional filters. Each filter is skipped when its parameter is null
     * (and {@code onlyOverdue} is skipped when false). Internal-only tickets ARE included —
     * this is the support team's own view.
     *
     * <p>The institute filter is gated by {@code hasInstitutes} rather than a null check on the
     * collection: binding null (or an empty list) to an {@code IN} parameter is not portable and
     * blows up at bind time. Callers MUST pass a non-empty {@code instituteIds} — use a throwaway
     * sentinel when {@code hasInstitutes} is false; the OR makes it unreachable.
     */
    @Query("SELECT t FROM SupportTicket t WHERE "
            + "(:hasInstitutes = false OR t.instituteId IN :instituteIds) AND "
            + "(:status IS NULL OR t.status = :status) AND "
            + "(:engineerId IS NULL OR t.assignedEngineerId = :engineerId) AND "
            + "(:onlyOverdue = false OR (t.firstRespondedAt IS NULL AND t.firstResponseDueAt IS NOT NULL "
            + "    AND t.firstResponseDueAt < :now "
            + "    AND t.status NOT IN (vacademy.io.community_service.feature.support.enums.TicketStatus.RESOLVED, "
            + "    vacademy.io.community_service.feature.support.enums.TicketStatus.CLOSED)))")
    Page<SupportTicket> searchTickets(@Param("hasInstitutes") boolean hasInstitutes,
                                      @Param("instituteIds") Collection<String> instituteIds,
                                      @Param("status") TicketStatus status,
                                      @Param("engineerId") String engineerId,
                                      @Param("onlyOverdue") boolean onlyOverdue,
                                      @Param("now") Date now,
                                      Pageable pageable);

    long countByStatus(TicketStatus status);

    long countByStatusIn(Collection<TicketStatus> statuses);

    @Query("SELECT COUNT(t) FROM SupportTicket t WHERE t.firstRespondedAt IS NULL "
            + "AND t.firstResponseDueAt IS NOT NULL AND t.firstResponseDueAt < :now "
            + "AND t.status NOT IN (vacademy.io.community_service.feature.support.enums.TicketStatus.RESOLVED, "
            + "vacademy.io.community_service.feature.support.enums.TicketStatus.CLOSED)")
    long countOverdue(@Param("now") Date now);
}
