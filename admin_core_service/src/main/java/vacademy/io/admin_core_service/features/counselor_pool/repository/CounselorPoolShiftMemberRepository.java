package vacademy.io.admin_core_service.features.counselor_pool.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolShiftMember;

import java.util.Collection;
import java.util.List;

@Repository
public interface CounselorPoolShiftMemberRepository extends JpaRepository<CounselorPoolShiftMember, String> {

    List<CounselorPoolShiftMember> findByShiftId(String shiftId);

    List<CounselorPoolShiftMember> findByShiftIdIn(Collection<String> shiftIds);

    /**
     * Active members across a set of shifts. The routing engine passes the
     * IDs of shifts active right now, and gets back the union of all
     * counselors on those shifts.
     */
    @Query("SELECT m FROM CounselorPoolShiftMember m " +
           " WHERE m.shiftId IN :shiftIds " +
           "   AND m.status = 'ACTIVE'")
    List<CounselorPoolShiftMember> findActiveMembersInShifts(@Param("shiftIds") Collection<String> shiftIds);

    boolean existsByShiftIdAndCounselorUserId(String shiftId, String counselorUserId);

    void deleteByShiftId(String shiftId);

    void deleteByShiftIdIn(Collection<String> shiftIds);
}
