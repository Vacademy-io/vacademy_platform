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

    Page<SupportTicket> findByInstituteIdOrderByLastMessageAtDesc(String instituteId, Pageable pageable);

    Page<SupportTicket> findByInstituteIdAndStatusOrderByLastMessageAtDesc(
            String instituteId, TicketStatus status, Pageable pageable);

    long countByInstituteIdAndStatusIn(String instituteId, Collection<TicketStatus> statuses);

    // ---- Super-admin (console) facing --------------------------------------------

    /**
     * Inbox search with optional filters. Each filter is skipped when its parameter is null
     * (and {@code onlyOverdue} is skipped when false).
     */
    @Query("SELECT t FROM SupportTicket t WHERE "
            + "(:instituteId IS NULL OR t.instituteId = :instituteId) AND "
            + "(:status IS NULL OR t.status = :status) AND "
            + "(:engineerId IS NULL OR t.assignedEngineerId = :engineerId) AND "
            + "(:onlyOverdue = false OR (t.firstRespondedAt IS NULL AND t.firstResponseDueAt IS NOT NULL "
            + "    AND t.firstResponseDueAt < :now))")
    Page<SupportTicket> searchTickets(@Param("instituteId") String instituteId,
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
