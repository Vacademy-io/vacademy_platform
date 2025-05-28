package vacademy.io.admin_core_service.features.packages.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.institute.entity.LevelProjection;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.SessionProjection;

import java.util.List;

@Repository
public interface PackageRepository extends JpaRepository<PackageEntity, String> {

    // Get all distinct sessions of an institute_id
    @Query(value = "SELECT DISTINCT s.* FROM session s " +
            "JOIN package_session ps ON s.id = ps.session_id " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND ps.status IN (:statusList)",
            nativeQuery = true)
    List<SessionProjection> findDistinctSessionsByInstituteIdAndStatusIn(@Param("instituteId") String instituteId,
                                                                         @Param("statusList") List<String> statusList);


    @Query(value = "SELECT DISTINCT l.* FROM level l " +
            "JOIN package_session ps ON l.id = ps.level_id " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND l.status IN (:statusList) AND ps.status IN (:statusList)",
            nativeQuery = true)
    List<LevelProjection> findDistinctLevelsByInstituteIdAndStatusIn(@Param("instituteId") String instituteId,
                                                                     @Param("statusList") List<String> statusList);

    // Get all distinct packages of an institute_id
    @Query(value = "SELECT DISTINCT p.* FROM package p " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "JOIN package_session ps ON p.id = ps.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND p.status IN (:packageStatusList) " +
            "AND ps.status IN (:packageSessionStatusList)",
            nativeQuery = true)
    List<PackageEntity> findDistinctPackagesByInstituteIdAndStatuses(
            @Param("instituteId") String instituteId,
            @Param("packageStatusList") List<String> packageStatusList,
            @Param("packageSessionStatusList") List<String> packageSessionStatusList);

    // Get all package sessions of an institute_id and of a session_id
    @Query(value = "SELECT ps.id, ps.level_id, ps.session_id, ps.start_time, ps.updated_at, ps.created_at, ps.status, ps.package_id " +
            "FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId AND ps.status != 'DELETED'",
            nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteId(
            @Param("instituteId") String instituteId);

    @Query(value = """
                SELECT DISTINCT s.* 
                FROM session s
                INNER JOIN package_session ps ON s.id = ps.session_id
                INNER JOIN package p ON ps.package_id = p.id
                WHERE ps.package_id = :packageId 
                  AND s.status != 'DELETED' 
                  AND ps.status != 'DELETED'
            """, nativeQuery = true)
    List<SessionProjection> findDistinctSessionsByPackageId(@Param("packageId") String packageId);


    @Query(value = "SELECT DISTINCT p.* FROM package p " +
            "JOIN package_session ps ON p.id = ps.package_id " +
            "JOIN student_session_institute_group_mapping ssgm ON ssgm.package_session_id = ps.id " +
            "WHERE ssgm.institute_id = :instituteId " +
            "AND ssgm.user_id = :userId " +
            "AND p.status != 'DELETED'",
            nativeQuery = true)
    List<PackageEntity> findDistinctPackagesByUserIdAndInstituteId(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId);

    @Query(value = "SELECT COUNT(DISTINCT p.id) FROM package p " +
            "JOIN package_session ps ON p.id = ps.package_id " +
            "JOIN student_session_institute_group_mapping ssgm ON ssgm.package_session_id = ps.id " +
            "WHERE ssgm.institute_id = :instituteId " +
            "AND ssgm.user_id = :userId " +
            "AND p.status != 'DELETED'",
            nativeQuery = true)
    Integer countDistinctPackagesByUserIdAndInstituteId(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId);

    @Query(value = "SELECT COUNT(DISTINCT p.id) FROM package p " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "JOIN package_session ps ON p.id = ps.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND p.status != 'DELETED' " +
            "AND ps.status != 'DELETED'",
            nativeQuery = true)
    Long countDistinctPackagesByInstituteId(@Param("instituteId") String instituteId);

    @Query(value = "SELECT COUNT(DISTINCT ps.level_id) FROM package_session ps " +
            "JOIN package p ON ps.package_id = p.id " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "WHERE pi.institute_id = :instituteId " +
            "AND p.status != 'DELETED' " +
            "AND ps.status != 'DELETED' and ps.level_id != 'DEFAULT' ",
            nativeQuery = true)
    Long countDistinctLevelsByInstituteId(@Param("instituteId") String instituteId);

    @Query(value = "SELECT DISTINCT TRIM(tag) FROM package p " +
            "JOIN package_institute pi ON p.id = pi.package_id, " +
            "LATERAL unnest(string_to_array(p.comma_separated_tags, ',')) AS tag " +
            "WHERE pi.institute_id = :instituteId " +
            "AND p.status != 'DELETED' " +
            "AND p.comma_separated_tags IS NOT NULL " +
            "AND p.comma_separated_tags != ''",
            nativeQuery = true)
    List<String> findAllDistinctTagsByInstituteId(@Param("instituteId") String instituteId);

}