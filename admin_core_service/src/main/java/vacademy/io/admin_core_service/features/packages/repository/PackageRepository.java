package vacademy.io.admin_core_service.features.packages.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailProjection;
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

    @Query(value = "SELECT DISTINCT p.* FROM package p " +
            "JOIN package_institute pi ON p.id = pi.package_id " +
            "LEFT JOIN package_session ps_level_filter ON p.id = ps_level_filter.package_id AND ps_level_filter.status != 'DELETED' " +
            "WHERE pi.institute_id = :instituteId " +
            // Status filter
            "AND ( (:#{#statuses == null || #statuses.isEmpty()} = true AND p.status != 'DELETED') OR (:#{#statuses != null && !#statuses.isEmpty()} = true AND p.status IN (:statuses)) ) " +
            // Level IDs filter
            "AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR ps_level_filter.level_id IN (:levelIds)) " +
            // Tags filter:
            // The :tags parameter is now guaranteed to be a non-empty list from the service layer.
            // It will either contain actual tags to filter by, or a placeholder.
            "AND ( "+
            "      (:#{#tags[0].equals('__NO_TAGS_FILTER_PLACEHOLDER__')} = true) OR " +
            "      (:#{#tags[0].equals('__EMPTY_TAGS_LIST_PLACEHOLDER__')} = true) OR " +
            "      (EXISTS (SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) s_tag " +
            "               WHERE TRIM(lower(s_tag)) = ANY(CAST(:tags AS TEXT[])) )) " +
            ") " +
            // Search by name filter
            "AND (:#{#searchByName == null || #searchByName.trim().isEmpty()} = true OR p.package_name ILIKE CONCAT('%', :searchByName, '%')) ",
            countQuery = "SELECT COUNT(DISTINCT p.id) FROM package p " +
                    "JOIN package_institute pi ON p.id = pi.package_id " +
                    "LEFT JOIN package_session ps_level_filter ON p.id = ps_level_filter.package_id AND ps_level_filter.status != 'DELETED' " +
                    "WHERE pi.institute_id = :instituteId " +
                    "AND ( (:#{#statuses == null || #statuses.isEmpty()} = true AND p.status != 'DELETED') OR (:#{#statuses != null && !#statuses.isEmpty()} = true AND p.status IN (:statuses)) ) " +
                    "AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR ps_level_filter.level_id IN (:levelIds)) " +
                    // Matching tags filter logic for count query
                    "AND ( "+
                    "      (:#{#tags[0].equals('__NO_TAGS_FILTER_PLACEHOLDER__')} = true) OR " +
                    "      (:#{#tags[0].equals('__EMPTY_TAGS_LIST_PLACEHOLDER__')} = true) OR " +
                    "      (EXISTS (SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) s_tag " +
                    "               WHERE TRIM(lower(s_tag)) = ANY(CAST(:tags AS TEXT[])) )) " +
                    ") " +
                    "AND (:#{#searchByName == null || #searchByName.trim().isEmpty()} = true OR p.package_name ILIKE CONCAT('%', :searchByName, '%')) ",
            nativeQuery = true)
    Page<PackageEntity> findPackagesByCriteria(
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses,
            @Param("levelIds") List<String> levelIds,
            @Param("tags") List<String> tags, // Will now always be a non-empty list from service
            @Param("searchByName") String searchByName,
            Pageable pageable
    );

    @Query(value = """
    SELECT
        p.id AS id,
        p.package_name AS packageName,
        p.thumbnail_file_id AS thumbnailFileId,
        p.is_course_published_to_catalaouge AS isCoursePublishedToCatalaouge,
        p.course_preview_image_media_id AS coursePreviewImageMediaId,
        p.course_banner_media_id AS courseBannerMediaId,
        p.course_media_id AS courseMediaId,
        p.why_learn AS whyLearnHtml,
        p.who_should_learn AS whoShouldLearnHtml,
        p.about_the_course AS aboutTheCourseHtml,
        p.comma_separated_tags AS commaSeparetedTags,
        p.course_depth AS courseDepth,
        p.course_html_description AS courseHtmlDescriptionHtml,
        p.created_at AS createdAt,
        COALESCE(SUM(CAST(lo.value AS DOUBLE PRECISION)), 0) AS percentageCompleted,
        5.0 AS rating,
        ps.id AS packageSessionId,
        l.id AS levelId,
        l.level_name AS levelName,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT fspm.user_id), NULL) AS facultyUserIds
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN learner_operation lo
        ON lo.source = 'PACKAGE_SESSION'
        AND lo.source_id = ps.id
        AND (:userId IS NULL OR lo.user_id = :userId)
        AND (:#{#learnerOperations == null || #learnerOperations.isEmpty()} = true OR lo.operation IN (:learnerOperations))
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id
        AND fspm.subject_id IS NULL
    WHERE
        (:userId IS NULL OR lo.user_id = :userId)
        AND (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR l.id IN (:levelIds))
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#facultyIds == null || #facultyIds.isEmpty()} = true OR fspm.user_id IN (:facultyIds))
        AND (:#{#facultySubjectSessionStatus == null || #facultySubjectSessionStatus.isEmpty()} = true OR fspm.status IN (:facultySubjectSessionStatus))
        AND (
            :#{#tags == null || #tags.isEmpty()} = true
            OR EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE tag ILIKE ANY (array[:#{#tags}])
            )
        )
    GROUP BY
        p.id, p.package_name, p.thumbnail_file_id, p.is_course_published_to_catalaouge,
        p.course_preview_image_media_id, p.course_banner_media_id, p.course_media_id,
        p.why_learn, p.who_should_learn, p.about_the_course, p.comma_separated_tags,
        p.course_depth, p.course_html_description, p.created_at,
        ps.id, l.id, l.level_name
    HAVING
        COALESCE(SUM(CAST(lo.value AS DOUBLE PRECISION)), 0) BETWEEN :minPercentage AND :maxPercentage
    """,
        countQuery = """
    SELECT COUNT(DISTINCT p.id)
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN learner_operation lo
        ON lo.source = 'PACKAGE_SESSION'
        AND lo.source_id = ps.id
        AND (:userId IS NULL OR lo.user_id = :userId)
        AND (:#{#learnerOperations == null || #learnerOperations.isEmpty()} = true OR lo.operation IN (:learnerOperations))
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id
        AND fspm.subject_id IS NULL
    WHERE
        (:userId IS NULL OR lo.user_id = :userId)
        AND (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR l.id IN (:levelIds))
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#facultyIds == null || #facultyIds.isEmpty()} = true OR fspm.user_id IN (:facultyIds))
        AND (:#{#facultySubjectSessionStatus == null || #facultySubjectSessionStatus.isEmpty()} = true OR fspm.status IN (:facultySubjectSessionStatus))
        AND (
            :#{#tags == null || #tags.isEmpty()} = true
            OR EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE tag ILIKE ANY (array[:#{#tags}])
            )
        )
    GROUP BY p.id
    HAVING COALESCE(SUM(CAST(lo.value AS DOUBLE PRECISION)), 0) BETWEEN :minPercentage AND :maxPercentage
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getLearnerPackageDetail(
        @Param("userId") String userId,
        @Param("instituteId") String instituteId,
        @Param("levelIds") List<String> levelIds,
        @Param("packageStatus") List<String> packageStatus,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("learnerOperations") List<String> learnerOperations,
        @Param("minPercentage") double minPercentage,
        @Param("maxPercentage") double maxPercentage,
        @Param("facultyIds") List<String> facultyIds,
        @Param("facultySubjectSessionStatus") List<String> facultySubjectSessionStatus,
        @Param("tags") List<String> tags,
        Pageable pageable
    );


    // to do: here I have hard coded the rating of course

    @Query(value = """
    SELECT
        p.id AS id,
        p.package_name AS packageName,
        p.thumbnail_file_id AS thumbnailFileId,
        p.is_course_published_to_catalaouge AS isCoursePublishedToCatalaouge,
        p.course_preview_image_media_id AS coursePreviewImageMediaId,
        p.course_banner_media_id AS courseBannerMediaId,
        p.course_media_id AS courseMediaId,
        p.why_learn AS whyLearnHtml,
        p.who_should_learn AS whoShouldLearnHtml,
        p.about_the_course AS aboutTheCourseHtml,
        p.comma_separated_tags AS commaSeparetedTags,
        p.course_depth AS courseDepth,
        p.course_html_description AS courseHtmlDescriptionHtml,
        p.created_at AS createdAt,
        COALESCE(SUM(CAST(lo.value AS DOUBLE PRECISION)), 0) AS percentageCompleted,
        5.0 AS rating,
        ps.id AS packageSessionId,
        l.id AS levelId,
        l.level_name AS levelName,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT fspm.user_id), NULL) AS facultyUserIds
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN learner_operation lo
        ON lo.source = 'PACKAGE_SESSION'
        AND lo.source_id = ps.id
        AND (:userId IS NULL OR lo.user_id = :userId)
        AND (:#{#learnerOperations == null || #learnerOperations.isEmpty()} = true OR lo.operation IN (:learnerOperations))
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id
        AND fspm.subject_id IS NULL
    WHERE
        (:userId IS NULL OR lo.user_id = :userId)
        AND (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#facultySubjectSessionStatus == null || #facultySubjectSessionStatus.isEmpty()} = true OR fspm.status IN (:facultySubjectSessionStatus))
        AND (
            :name IS NULL OR
            LOWER(p.package_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            LOWER(l.level_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE LOWER(tag) LIKE LOWER(CONCAT('%', :name, '%'))
            ) OR
            LOWER(fspm.name) LIKE LOWER(CONCAT('%', :name, '%'))
        )
    GROUP BY
        p.id, p.package_name, p.thumbnail_file_id, p.is_course_published_to_catalaouge,
        p.course_preview_image_media_id, p.course_banner_media_id, p.course_media_id,
        p.why_learn, p.who_should_learn, p.about_the_course, p.comma_separated_tags,
        p.course_depth, p.course_html_description, p.created_at,
        ps.id, l.id, l.level_name
    HAVING
        COALESCE(SUM(CAST(lo.value AS DOUBLE PRECISION)), 0) BETWEEN :minPercentage AND :maxPercentage
    """,

        countQuery = """
    SELECT COUNT(DISTINCT p.id)
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN learner_operation lo
        ON lo.source = 'PACKAGE_SESSION'
        AND lo.source_id = ps.id
        AND (:userId IS NULL OR lo.user_id = :userId)
        AND (:#{#learnerOperations == null || #learnerOperations.isEmpty()} = true OR lo.operation IN (:learnerOperations))
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id
        AND fspm.subject_id IS NULL
    WHERE
        (:userId IS NULL OR lo.user_id = :userId)
        AND (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#facultySubjectSessionStatus == null || #facultySubjectSessionStatus.isEmpty()} = true OR fspm.status IN (:facultySubjectSessionStatus))
        AND (
            :name IS NULL OR
            LOWER(p.package_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            LOWER(l.level_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE LOWER(tag) LIKE LOWER(CONCAT('%', :name, '%'))
            ) OR
            LOWER(fspm.name) LIKE LOWER(CONCAT('%', :name, '%'))
        )
    GROUP BY p.id
    HAVING COALESCE(SUM(CAST(lo.value AS DOUBLE PRECISION)), 0) BETWEEN :minPercentage AND :maxPercentage
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getLearnerPackageDetail(
        @Param("userId") String userId,
        @Param("name") String name,
        @Param("instituteId") String instituteId,
        @Param("packageStatus") List<String> packageStatus,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("learnerOperations") List<String> learnerOperations,
        @Param("minPercentage") double minPercentage,
        @Param("maxPercentage") double maxPercentage,
        @Param("facultySubjectSessionStatus") List<String> facultySubjectSessionStatus,
        Pageable pageable
    );


    // to do: here I have hard coded the rating of course

    @Query(value = """
    SELECT
        p.id AS id,
        p.package_name AS packageName,
        p.thumbnail_file_id AS thumbnailFileId,
        p.is_course_published_to_catalaouge AS isCoursePublishedToCatalaouge,
        p.course_preview_image_media_id AS coursePreviewImageMediaId,
        p.course_banner_media_id AS courseBannerMediaId,
        p.course_media_id AS courseMediaId,
        p.why_learn AS whyLearnHtml,
        p.who_should_learn AS whoShouldLearnHtml,
        p.about_the_course AS aboutTheCourseHtml,
        p.comma_separated_tags AS commaSeparetedTags,
        p.course_depth AS courseDepth,
        p.course_html_description AS courseHtmlDescriptionHtml,
        p.created_at AS createdAt,
        5.0 AS rating,
        ps.id AS packageSessionId,
        l.id AS levelId,
        l.level_name AS levelName,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT fspm.user_id), NULL) AS facultyUserIds
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id
        AND fspm.subject_id IS NULL
    WHERE
        (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
        AND (:#{#facultySubjectSessionStatus == null || #facultySubjectSessionStatus.isEmpty()} = true OR fspm.status IN (:facultySubjectSessionStatus))
        AND (
            :name IS NULL OR
            LOWER(p.package_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            LOWER(l.level_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE LOWER(tag) LIKE LOWER(CONCAT('%', :name, '%'))
            ) OR
            LOWER(fspm.name) LIKE LOWER(CONCAT('%', :name, '%'))
        )
    GROUP BY
        p.id, p.package_name, p.thumbnail_file_id, p.is_course_published_to_catalaouge,
        p.course_preview_image_media_id, p.course_banner_media_id, p.course_media_id,
        p.why_learn, p.who_should_learn, p.about_the_course, p.comma_separated_tags,
        p.course_depth, p.course_html_description, p.created_at,
        ps.id, l.id, l.level_name
    """,

        countQuery = """
    SELECT COUNT(DISTINCT p.id)
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id
        AND fspm.subject_id IS NULL
    WHERE
        (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
        AND (:#{#facultySubjectSessionStatus == null || #facultySubjectSessionStatus.isEmpty()} = true OR fspm.status IN (:facultySubjectSessionStatus))
        AND (
            :name IS NULL OR
            LOWER(p.package_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            LOWER(l.level_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE LOWER(tag) LIKE LOWER(CONCAT('%', :name, '%'))
            ) OR
            LOWER(fspm.name) LIKE LOWER(CONCAT('%', :name, '%'))
        )
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getCatalogPackageDetail(
        @Param("name") String name,
        @Param("instituteId") String instituteId,
        @Param("packageStatus") List<String> packageStatus,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("levelStatus") List<String> levelStatus,
        @Param("facultySubjectSessionStatus") List<String> facultySubjectSessionStatus,
        Pageable pageable
    );

    @Query(value = """
    SELECT
        p.id AS id,
        p.package_name AS packageName,
        p.thumbnail_file_id AS thumbnailFileId,
        p.is_course_published_to_catalaouge AS isCoursePublishedToCatalaouge,
        p.course_preview_image_media_id AS coursePreviewImageMediaId,
        p.course_banner_media_id AS courseBannerMediaId,
        p.course_media_id AS courseMediaId,
        p.why_learn AS whyLearnHtml,
        p.who_should_learn AS whoShouldLearnHtml,
        p.about_the_course AS aboutTheCourseHtml,
        p.comma_separated_tags AS commaSeparetedTags,
        p.course_depth AS courseDepth,
        p.course_html_description AS courseHtmlDescriptionHtml,
        p.created_at AS createdAt,
        5.0 AS rating,
        ps.id AS packageSessionId,
        l.id AS levelId,
        l.level_name AS levelName,
        ARRAY_REMOVE(
            ARRAY_AGG(DISTINCT
                CASE
                    WHEN fspm.status IN (:facultySubjectSessionStatus) AND fspm.subject_id IS NULL THEN fspm.user_id
                    ELSE NULL
                END
            ), NULL
        ) AS facultyUserIds
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN faculty_subject_package_session_mapping fspm ON fspm.package_session_id = ps.id
    WHERE
        (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
        AND (
            :name IS NULL OR
            LOWER(p.package_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            LOWER(l.level_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE LOWER(tag) LIKE LOWER(CONCAT('%', :name, '%'))
            ) OR
            LOWER(fspm.name) LIKE LOWER(CONCAT('%', :name, '%'))
        )
        AND (
            :#{#userIds == null || #userIds.isEmpty()} = true
            OR EXISTS (
                SELECT 1
                FROM faculty_subject_package_session_mapping f
                WHERE f.package_session_id = ps.id
                AND f.subject_id IS NULL
                AND f.user_id IN (:userIds)
                AND f.status IN (:facultySubjectSessionStatus)
            )
        )
    GROUP BY
        p.id, p.package_name, p.thumbnail_file_id, p.is_course_published_to_catalaouge,
        p.course_preview_image_media_id, p.course_banner_media_id, p.course_media_id,
        p.why_learn, p.who_should_learn, p.about_the_course, p.comma_separated_tags,
        p.course_depth, p.course_html_description, p.created_at,
        ps.id, l.id, l.level_name
    """,

        countQuery = """
    SELECT COUNT(DISTINCT p.id)
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN faculty_subject_package_session_mapping fspm ON fspm.package_session_id = ps.id
    WHERE
        (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
        AND (
            :name IS NULL OR
            LOWER(p.package_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            LOWER(l.level_name) LIKE LOWER(CONCAT('%', :name, '%')) OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE LOWER(tag) LIKE LOWER(CONCAT('%', :name, '%'))
            ) OR
            LOWER(fspm.name) LIKE LOWER(CONCAT('%', :name, '%'))
        )
        AND (
            :#{#userIds == null || #userIds.isEmpty()} = true
            OR EXISTS (
                SELECT 1
                FROM faculty_subject_package_session_mapping f
                WHERE f.package_session_id = ps.id
                AND f.subject_id IS NULL
                AND f.user_id IN (:userIds)
                AND f.status IN (:facultySubjectSessionStatus)
            )
        )
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getCatalogPackageDetail(
        @Param("name") String name,
        @Param("userIds") List<String> userIds,
        @Param("instituteId") String instituteId,
        @Param("packageStatus") List<String> packageStatus,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("levelStatus") List<String> levelStatus,
        @Param("facultySubjectSessionStatus") List<String> facultySubjectSessionStatus,
        Pageable pageable
    );

    @Query(value = """
    SELECT
        p.id AS id,
        p.package_name AS packageName,
        p.thumbnail_file_id AS thumbnailFileId,
        p.is_course_published_to_catalaouge AS isCoursePublishedToCatalaouge,
        p.course_preview_image_media_id AS coursePreviewImageMediaId,
        p.course_banner_media_id AS courseBannerMediaId,
        p.course_media_id AS courseMediaId,
        p.why_learn AS whyLearnHtml,
        p.who_should_learn AS whoShouldLearnHtml,
        p.about_the_course AS aboutTheCourseHtml,
        p.comma_separated_tags AS commaSeparetedTags,
        p.course_depth AS courseDepth,
        p.course_html_description AS courseHtmlDescriptionHtml,
        p.created_at AS createdAt,
        0.0 AS percentageCompleted,
        5.0 AS rating,
        ps.id AS packageSessionId,
        l.id AS levelId,
        l.level_name AS levelName,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT fspm.user_id), NULL) AS facultyUserIds
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id AND fspm.subject_id IS NULL
    WHERE
        (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR l.id IN (:levelIds))
        AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#facultyIds == null || #facultyIds.isEmpty()} = true OR fspm.user_id IN (:facultyIds))
        AND (:#{#facultyPackageSessionStatus == null || #facultyPackageSessionStatus.isEmpty()} = true OR fspm.status IN (:facultyPackageSessionStatus))
        AND (
            :#{#tags == null || #tags.isEmpty()} = true OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE tag ILIKE ANY (array[:#{#tags}])
            )
        )
    GROUP BY
        p.id, p.package_name, p.thumbnail_file_id, p.is_course_published_to_catalaouge,
        p.course_preview_image_media_id, p.course_banner_media_id, p.course_media_id,
        p.why_learn, p.who_should_learn, p.about_the_course, p.comma_separated_tags,
        p.course_depth, p.course_html_description, p.created_at,
        ps.id, l.id, l.level_name
    """,

        countQuery = """
    SELECT COUNT(DISTINCT p.id)
    FROM package p
    JOIN package_session ps ON ps.package_id = p.id
    JOIN level l ON l.id = ps.level_id
    JOIN package_institute pi ON pi.package_id = p.id
    LEFT JOIN faculty_subject_package_session_mapping fspm
        ON fspm.package_session_id = ps.id AND fspm.subject_id IS NULL
    WHERE
        (:instituteId IS NULL OR pi.institute_id = :instituteId)
        AND (:#{#levelIds == null || #levelIds.isEmpty()} = true OR l.id IN (:levelIds))
        AND (:#{#levelStatus == null || #levelStatus.isEmpty()} = true OR l.status IN (:levelStatus))
        AND (:#{#packageStatus == null || #packageStatus.isEmpty()} = true OR p.status IN (:packageStatus))
        AND (:#{#packageSessionStatus == null || #packageSessionStatus.isEmpty()} = true OR ps.status IN (:packageSessionStatus))
        AND (:#{#facultyIds == null || #facultyIds.isEmpty()} = true OR fspm.user_id IN (:facultyIds))
        AND (:#{#facultyPackageSessionStatus == null || #facultyPackageSessionStatus.isEmpty()} = true OR fspm.status IN (:facultyPackageSessionStatus))
        AND (
            :#{#tags == null || #tags.isEmpty()} = true OR
            EXISTS (
                SELECT 1 FROM unnest(string_to_array(p.comma_separated_tags, ',')) AS tag
                WHERE tag ILIKE ANY (array[:#{#tags}])
            )
        )
    """,
        nativeQuery = true)
    Page<PackageDetailProjection> getCatalogPackageDetail(
        @Param("instituteId") String instituteId,
        @Param("levelIds") List<String> levelIds,
        @Param("packageStatus") List<String> packageStatus,
        @Param("packageSessionStatus") List<String> packageSessionStatus,
        @Param("facultyIds") List<String> facultyIds,
        @Param("facultyPackageSessionStatus") List<String> facultyPackageSessionStatus,
        @Param("tags") List<String> tags,
        @Param("levelStatus") List<String> levelStatus,
        Pageable pageable
    );
}
