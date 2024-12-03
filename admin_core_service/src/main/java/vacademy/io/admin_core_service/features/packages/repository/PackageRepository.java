package vacademy.io.admin_core_service.features.packages.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.institute.entity.Package;
import vacademy.io.common.institute.entity.PackageSession;
import vacademy.io.common.institute.entity.Session;

import java.util.List;

@Repository
public interface PackageRepository extends JpaRepository<Package, String> {

    // Get all distinct sessions of an institute_id
    @Query(value = "SELECT DISTINCT s.* FROM public.session s " +
            "JOIN public.package_session ps ON s.id = ps.session_id " +
            "JOIN public.package p ON ps.package_id = p.id " +
            "WHERE p.institute_id = :instituteId",
            nativeQuery = true)
    List<Session> findDistinctSessionsByInstituteId(@Param("instituteId") String instituteId);

    // Get all distinct packages of an institute_id
    @Query(value = "SELECT DISTINCT p.* FROM public.package p " +
            "WHERE p.institute_id = :instituteId",
            nativeQuery = true)
    List<Package> findDistinctPackagesByInstituteId(@Param("instituteId") String instituteId);

    // Get all package sessions of an institute_id and of a session_id
    @Query(value = "SELECT ps.* FROM public.package_session ps " +
            "JOIN public.package p ON ps.package_id = p.id " +
            "WHERE p.institute_id = :instituteId AND ps.session_id = :sessionId",
            nativeQuery = true)
    List<PackageSession> findPackageSessionsByInstituteIdAndSessionId(
            @Param("instituteId") String instituteId,
            @Param("sessionId") String sessionId);

}