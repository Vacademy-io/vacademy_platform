package vacademy.io.admin_core_service.features.institute.repository;


import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstituteRepository extends CrudRepository<Institute, String> {

    @Query(value = "SELECT DISTINCT i.* " +
            "FROM staff s " +
            "JOIN institutes i ON s.institute_id = i.id " +
            "WHERE s.user_id = :userId", nativeQuery = true)
    List<Institute> findInstitutesByUserId(@Param("userId") String userId);


    @Transactional
    @Modifying
    @Query(value = "INSERT INTO institutes (id, name, country, state, city, address_line, pin_code, email, mobile_number, website_url) " +
            "VALUES (:newId, :#{#institute.instituteName}, :#{#institute.country}, :#{#institute.state}, :#{#institute.city}, " +
            ":#{#institute.address}, :#{#institute.pinCode}, :#{#institute.email}, :#{#institute.mobileNumber}, :#{#institute.websiteUrl})",
            nativeQuery = true)
    void insertInstitute(@Param("newId") String newId,
                         @Param("institute") Institute institute);



    @Query(value = """
            SELECT
                (
                    (CASE WHEN name IS NULL OR name = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN address_line IS NULL OR address_line = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN pin_code IS NULL OR pin_code = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN mobile_number IS NULL OR mobile_number = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN logo_file_id IS NULL OR logo_file_id = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN website_url IS NULL OR website_url = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN "type" IS NULL OR "type" = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN country IS NULL OR country = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN state IS NULL OR state = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN city IS NULL OR city = '' THEN 1 ELSE 0 END) +
                    (CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END)
                ) AS null_or_empty_count
            FROM
                institutes
            WHERE
                id = :instituteId
            """, nativeQuery = true)
    public Integer findCountForNullOrEmptyFields(@Param("instituteId") String instituteId);

    @Query("""
    SELECT i FROM Institute i
    JOIN StudentSessionInstituteGroupMapping s ON i.id = s.institute.id
    JOIN PackageSession ps ON s.packageSession.id = ps.id
    JOIN ChapterPackageSessionMapping cpsm ON ps.id = cpsm.packageSession.id
    JOIN Chapter c ON cpsm.chapter.id = c.id
    WHERE c.id = :chapterId
""")
    Optional<Institute> findInstituteByChapterId(@Param("chapterId") String chapterId);

}
