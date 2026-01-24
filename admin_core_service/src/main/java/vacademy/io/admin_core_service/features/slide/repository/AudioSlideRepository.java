package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.AudioSlide;

/**
 * Repository for AudioSlide entity operations.
 */
@Repository
public interface AudioSlideRepository extends JpaRepository<AudioSlide, String> {

    /**
     * Get the published audio length for a slide.
     * Used for calculating percentage completion.
     * 
     * @param slideId The slide ID
     * @return Published audio length in milliseconds, or 1 if not found
     */
    @Query(value = """
            SELECT
                COALESCE(
                    (
                        SELECT a.published_audio_length_in_millis
                        FROM slide s
                        JOIN audio_slide a ON s.source_id = a.id
                        WHERE s.id = :slideId
                        ORDER BY a.created_at DESC
                        LIMIT 1
                    ),
                    1
                ) AS published_audio_length
            """, nativeQuery = true)
    Long getPublishedAudioLength(@Param("slideId") String slideId);

    /**
     * Get audio length for a slide.
     * 
     * @param slideId The slide ID
     * @return Audio length in milliseconds
     */
    @Query(value = """
            SELECT a.audio_length_in_millis
            FROM slide s
            JOIN audio_slide a ON s.source_id = a.id
            WHERE s.id = :slideId
            LIMIT 1
            """, nativeQuery = true)
    Long getAudioLength(@Param("slideId") String slideId);
}
