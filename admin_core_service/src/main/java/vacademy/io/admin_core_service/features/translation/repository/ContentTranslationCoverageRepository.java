package vacademy.io.admin_core_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.translation.entity.ContentTranslationCoverage;

import java.util.List;
import java.util.Optional;

public interface ContentTranslationCoverageRepository extends JpaRepository<ContentTranslationCoverage, String> {

    Optional<ContentTranslationCoverage> findByPackageSessionIdAndLocale(String packageSessionId, String locale);

    /** Locales with at least one learner-visible translation for the package session. */
    @Query("""
            SELECT c.locale FROM ContentTranslationCoverage c
            WHERE c.packageSessionId = :packageSessionId AND c.publishedCount > 0
            ORDER BY c.locale
            """)
    List<String> findAvailableLocales(@Param("packageSessionId") String packageSessionId);
}
