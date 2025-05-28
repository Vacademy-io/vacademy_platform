package vacademy.io.admin_core_service.features.doubts.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;

import java.util.List;


@Repository
public interface DoubtsAssigneeRepository extends JpaRepository<DoubtAssignee, String> {

    @Query(value = """
            SELECT da.* FROM doubt_assignee da
            WHERE da.doubt_id = :doubtId
            AND da.status NOT IN (:statusList)
            """,nativeQuery = true)
    List<DoubtAssignee> findByDoubtIdAndStatusNotIn(@Param("doubtId") String doubtId,
                                                    @Param("statusList") List<String> statusList);
}
