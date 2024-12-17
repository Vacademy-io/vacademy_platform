package vacademy.io.assessment_service.features.question_bank.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;

import java.util.List;
import java.util.UUID;

public interface QuestionPaperRepository extends JpaRepository<QuestionPaper, String> {

    @Query(value = "SELECT qp.* FROM institute_question_paper iq INNER JOIN question_paper qp ON iq.question_paper_id = qp.id WHERE iq.institute_id = :instituteId",
            countQuery = "SELECT COUNT(qp.id) FROM institute_question_paper iq INNER JOIN question_paper qp ON iq.question_paper_id = qp.id WHERE iq.institute_id = :instituteId",
            nativeQuery = true)
    Page<QuestionPaper> findByInstituteId(@Param("instituteId") String instituteId, Pageable pageable);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO institute_question_paper (id, question_paper_id, institute_id, status) VALUES (:id, :questionPaperId, :instituteId, :status)", nativeQuery = true)
    void linkInstituteToQuestionPaper(@Param("id") String id, @Param("questionPaperId") String questionPaperId, @Param("instituteId") String instituteId, @Param("status") String status);

    // Add custom method for bulk insert
    @Modifying
    @Transactional
    default void bulkInsertQuestionsToQuestionPaper(String questionPaperId, List<String> questionIds) {
        StringBuilder sql = new StringBuilder("INSERT INTO public.question_question_paper_mapping (id, question_id, question_paper_id) VALUES ");

        for (int i = 0; i < questionIds.size(); i++) {
            String mappingId = UUID.randomUUID().toString(); // Generate unique ID for each mapping
            sql.append("('").append(mappingId).append("', '").append(questionIds.get(i)).append("', '").append(questionPaperId).append("')");
            if (i < questionIds.size() - 1) {
                sql.append(", ");
            }
        }

        // Execute the constructed SQL statement
        getEntityManager().createNativeQuery(sql.toString()).executeUpdate();
    }

    @PersistenceContext
    EntityManager getEntityManager();


    @Query("SELECT qp FROM QuestionPaper qp JOIN InstituteQuestionPaper iq ON qp.id = iq.questionPaperId " +
            "WHERE iq.instituteId = :instituteId AND (:title IS NULL OR qp.title LIKE %:title%)")
    Page<QuestionPaper> findByInstituteIdAndTitle(String instituteId, String title, Pageable pageable);


    @Query(
            value = "SELECT qp.* FROM question_paper qp " +
                    "LEFT JOIN institute_question_paper iq ON qp.id = iq.question_paper_id " +
                    "WHERE (:title IS NULL OR qp.title ILIKE CONCAT('%', :title, '%')) " +
                    "AND (:status IS NULL OR iq.status IN (:status)) " +
                    "AND (:levelIds IS NULL OR iq.level_id IN (:levelIds)) " +
                    "AND (:subjectIds IS NULL OR iq.subject_id IN (:subjectIds)) " +
                    "AND (:instituteIds IS NULL OR iq.institute_id IN (:instituteIds)) " +
                    "AND (:createdByUserId IS NULL OR qp.created_by_user_id = :createdByUserId) ",
            countQuery = "SELECT COUNT(qp) FROM question_paper qp " +
                    "LEFT JOIN institute_question_paper iq ON qp.id = iq.question_paper_id " +
                    "WHERE (:title IS NULL OR qp.title ILIKE CONCAT('%', :title, '%')) " +
                    "AND (:status IS NULL OR iq.status IN (:status)) " +
                    "AND (:levelIds IS NULL OR iq.level_id IN (:levelIds)) " +
                    "AND (:subjectIds IS NULL OR iq.subject_id IN (:subjectIds)) " +
                    "AND (:instituteIds IS NULL OR iq.institute_id IN (:instituteIds)) " +
                    "AND (:createdByUserId IS NULL OR qp.created_by_user_id = :createdByUserId) ",
            nativeQuery = true
    )
    Page<QuestionPaper> findQuestionPapersByFilters(
            @Param("title") String title,
            @Param("status") List<String> status,
            @Param("levelIds") List<String> levelIds,
            @Param("subjectIds") List<String> subjectIds,
            @Param("createdByUserId") String createdByUserId,
            @Param("instituteIds") List<String> instituteIds,
            Pageable pageable
    );

    @Modifying
    @Transactional
    @Query(value = "UPDATE institute_question_paper SET status = :status, updated_on = CURRENT_TIMESTAMP WHERE institute_id = :instituteId AND question_paper_id = :questionPaperId", nativeQuery = true)
    void updateStatusForInstituteQuestionPaper(String instituteId, String questionPaperId, String status);

}
