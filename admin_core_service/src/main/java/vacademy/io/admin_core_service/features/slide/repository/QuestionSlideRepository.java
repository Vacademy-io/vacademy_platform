package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.slide.entity.QuestionSlide;

import java.util.Optional;

public interface QuestionSlideRepository extends JpaRepository<QuestionSlide, String> {

        @Query("SELECT qs FROM QuestionSlide qs " +
                        "LEFT JOIN FETCH qs.textData " +
                        "LEFT JOIN FETCH qs.parentRichText " +
                        "LEFT JOIN FETCH qs.explanationTextData " +
                        "LEFT JOIN FETCH qs.options " +
                        "WHERE qs.id = :id")
        Optional<QuestionSlide> findByIdWithText(@Param("id") String id);
}
