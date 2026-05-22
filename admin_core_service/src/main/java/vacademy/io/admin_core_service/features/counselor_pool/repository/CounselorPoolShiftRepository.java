package vacademy.io.admin_core_service.features.counselor_pool.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolShift;

import java.sql.Time;
import java.util.List;

@Repository
public interface CounselorPoolShiftRepository extends JpaRepository<CounselorPoolShift, String> {

    /** All shifts for a pool, ordered for display. */
    List<CounselorPoolShift> findByPoolIdOrderByDayOfWeekAscStartTimeAsc(String poolId);

    /** All shifts for one day in a pool. Used by API-layer 24/7 coverage validation. */
    List<CounselorPoolShift> findByPoolIdAndDayOfWeekOrderByStartTimeAsc(String poolId, String dayOfWeek);

    /**
     * Shifts that are active right now for this pool. Used by the time-based
     * routing engine. Returns ACTIVE shifts whose [start_time, end_time)
     * window contains the supplied wall-clock time on the supplied day.
     */
    @Query("SELECT s FROM CounselorPoolShift s " +
           " WHERE s.poolId     = :poolId " +
           "   AND s.dayOfWeek  = :dayOfWeek " +
           "   AND s.startTime <= :nowTime " +
           "   AND s.endTime   >  :nowTime " +
           "   AND s.status     = 'ACTIVE'")
    List<CounselorPoolShift> findActiveShiftsForPoolAtTime(@Param("poolId") String poolId,
                                                           @Param("dayOfWeek") String dayOfWeek,
                                                           @Param("nowTime") Time nowTime);

    void deleteByPoolId(String poolId);
}
