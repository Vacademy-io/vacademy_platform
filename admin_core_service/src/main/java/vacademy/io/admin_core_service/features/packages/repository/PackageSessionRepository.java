package vacademy.io.admin_core_service.features.packages.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;
import java.util.Optional;

@Repository
public interface PackageSessionRepository extends JpaRepository<PackageSession, String> {


    // Get all package sessions of an institute_id and of a session_id
    @Query(value = "SELECT ps.id, ps.level_id, ps.session_id, ps.start_time, ps.updated_at, ps.created_at, ps.status, ps.package_id " +
            "FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND ps.status IN (:statuses)",
            nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteId(
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses);



    @Query(value = "SELECT ps.id, ps.level_id, ps.session_id, ps.start_time, ps.updated_at, ps.created_at, ps.status, ps.package_id " +
            "FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND ps.session_id = :sessionId",
            nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteIdAndSessionId(
            @Param("instituteId") String instituteId, @Param("sessionId") String sessionId);

    @Query("SELECT ps FROM PackageSession ps " +
            "WHERE ps.packageEntity.id = :packageId " +
            "AND ps.session.id = :sessionId " +
            "ORDER BY ps.updatedAt DESC LIMIT 1")
    Optional<PackageSession> findLatestPackageSessionByPackageIdAndSessionId(String packageId, String sessionId);

    @Query(value = "SELECT COUNT(ps.id) " +
            "FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND ps.status != 'DELETED'",
            nativeQuery = true)
    Long findCountPackageSessionsByInstituteId(@Param("instituteId") String instituteId);

    @Modifying
    @Transactional
    @Query("UPDATE PackageSession ps SET ps.status = :status WHERE ps.packageEntity.id IN :packageIds")
    void updateStatusByPackageIds(@Param("status") String status, @Param("packageIds") List<String> packageIds);

    @Modifying
    @Transactional
    @Query("UPDATE PackageSession ps SET ps.status = :status WHERE ps.level.id IN :levelIds")
    void updateStatusByLevelIds(@Param("status") String status, @Param("levelIds") List<String> levelIds);

    @Modifying
    @Transactional
    @Query("UPDATE PackageSession ps SET ps.status = :newStatus WHERE ps.id IN :packageSessionIds")
    int updateStatusByPackageSessionIds(@Param("newStatus") String newStatus,
                                        @Param("packageSessionIds") String[] packageSessionIds);

    @Modifying
    @Query("UPDATE PackageSession ps SET ps.status = :status WHERE ps.session.id IN :sessionIds")
    void updateStatusBySessionIds(@Param("sessionIds") List<String> sessionIds, @Param("status") String status);

}