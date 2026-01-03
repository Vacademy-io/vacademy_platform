package vacademy.io.admin_core_service.features.student_analysis.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vacademy.io.admin_core_service.features.student_analysis.entity.UserLinkedData;

import java.util.List;

public interface UserLinkedDataRepository extends JpaRepository<UserLinkedData, String> {

        /**
         * Find all user linked data for a specific user and type
         */
        List<UserLinkedData> findByUserIdAndType(String userId, String type);

        /**
         * Find user linked data by user, type, and data (case-insensitive)
         */
        @Query("SELECT u FROM UserLinkedData u WHERE u.userId = :userId AND u.type = :type AND LOWER(TRIM(u.data)) = LOWER(TRIM(:data))")
        UserLinkedData findByUserIdAndTypeAndData(String userId, String type, String data);

        /**
         * Find all user linked data for a specific user
         */
        List<UserLinkedData> findByUserId(String userId);
}
