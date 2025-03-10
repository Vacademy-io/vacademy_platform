package vacademy.io.common.auth.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.dto.RoleCountProjection;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;

import java.util.List;

@Repository
public interface UserRoleRepository extends CrudRepository<UserRole, String> {

    List<UserRole> findByUser(User user);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserRole ur WHERE ur.user.id = :userId AND ur.role.name IN :roleNames")
    void deleteUserRolesByUserIdAndRoleNames(@Param("userId") String userId, @Param("roleNames") List<String> roleNames);

    @Query("SELECT r.name AS roleName, COUNT(ur.user.id) AS userCount " +
            "FROM UserRole ur JOIN ur.role r " +
            "WHERE ur.instituteId = :instituteId and r.name != 'STUDENT' " +
            "GROUP BY r.name")
    List<RoleCountProjection> getUserRoleCountsByInstituteId(@Param("instituteId") String instituteId);

    @Transactional
    @Modifying
    @Query("UPDATE UserRole ur SET ur.status = :newStatus WHERE ur.instituteId = :instituteId AND ur.user.id IN (:userIds)")
    int updateUserRoleStatusByInstituteIdAndUserId(@Param("newStatus") String newStatus,
                                                   @Param("instituteId") String instituteId,
                                                   @Param("userIds") List<String> userIds);

}