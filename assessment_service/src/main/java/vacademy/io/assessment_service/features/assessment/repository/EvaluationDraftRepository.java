package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.EvaluationDraft;

import java.util.Optional;

@Repository
public interface EvaluationDraftRepository extends JpaRepository<EvaluationDraft, String> {

    // One shared draft per copy — any assigned faculty resumes the same one.
    Optional<EvaluationDraft> findByAttemptId(String attemptId);

    // Self-contained transaction: the draft cleanup on submit is best-effort and must
    // NEVER roll back the marks write, so it runs in its own tx rather than borrowing
    // the caller's. (A @Modifying query also requires an ambient transaction.)
    @Transactional
    @Modifying
    @Query("DELETE FROM EvaluationDraft d WHERE d.attemptId = :attemptId")
    void deleteByAttemptId(@Param("attemptId") String attemptId);
}
