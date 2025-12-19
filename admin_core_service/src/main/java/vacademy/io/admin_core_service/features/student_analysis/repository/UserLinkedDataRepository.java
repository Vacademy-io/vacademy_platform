package vacademy.io.admin_core_service.features.student_analysis.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.student_analysis.entity.UserLinkedData;

import java.util.List;

public interface UserLinkedDataRepository extends JpaRepository<UserLinkedData, String> {

        /**
         * Find all user linked data for a specific user and type
         */
        List<UserLinkedData> findByUserIdAndType(String userId, String type);

        /**
         * Delete all existing strength/weakness data for a user
         * Used before inserting new analysis results
         */
        @Modifying
        @Query("DELETE FROM UserLinkedData uld WHERE uld.userId = :userId AND uld.type IN ('strength', 'weakness')")
        void deleteByUserIdAndTypeIn(@Param("userId") String userId);

        /**
         * Find all user linked data for a specific user
         */
        List<UserLinkedData> findByUserId(String userId);
}
