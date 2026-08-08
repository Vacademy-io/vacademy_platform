package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vacademy.io.assessment_service.features.assessment.enums.QuestionEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression test for the production incident where every copy-check dispatch
 * died on:
 *
 * null value in column "is_edited" of relation "ai_question_evaluation"
 * violates not-null constraint
 *
 * V22 added is_edited as NOT NULL DEFAULT FALSE, but a column DEFAULT only
 * applies when the column is omitted from the INSERT. Hibernate always lists
 * every insertable column, so it sent an explicit NULL and the default never
 * fired. The default has to live on the entity instead.
 *
 * Needs a real Postgres carrying the assessment_service schema — the mapping is
 * only half the story, the NOT NULL constraint is the other half, so an
 * in-memory database would not reproduce it. Skipped unless
 * ASSESSMENT_TEST_DB_URL is set, so CI without a database stays green.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = AiQuestionEvaluationPersistenceTest.OrmOnlyConfig.class)
@EnabledIfEnvironmentVariable(named = "ASSESSMENT_TEST_DB_URL", matches = ".+")
class AiQuestionEvaluationPersistenceTest {

    /**
     * AssessmentServiceApplication pulls in web security via @Import, which a
     * slice test cannot filter out. Naming this as the context's configuration
     * stops the bootstrapper falling back to it, so only the ORM boots.
     */
    @Configuration
    @EntityScan(basePackages = "vacademy.io")
    @EnableJpaRepositories(basePackages = "vacademy.io.assessment_service.features.assessment.repository")
    static class OrmOnlyConfig {
    }

    @Autowired
    private AiQuestionEvaluationRepository repository;

    @Autowired
    private EntityManager entityManager;

    /**
     * evaluation_process_id and question_id are NOT NULL, so the row needs
     * parents. Lazy references write the FK without loading (or requiring) the
     * parent rows — the scratch database has the tracking table's foreign keys
     * dropped so the insert stands alone.
     */
    private AiQuestionEvaluation.AiQuestionEvaluationBuilder trackingRow() {
        return AiQuestionEvaluation.builder()
                .evaluationProcess(entityManager.getReference(AiEvaluationProcess.class, UUID.randomUUID().toString()))
                .question(entityManager.getReference(Question.class, UUID.randomUUID().toString()))
                .status(QuestionEvaluationStatusEnum.PENDING.name())
                .startedAt(new Date());
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("ASSESSMENT_TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("ASSESSMENT_TEST_DB_USER", ""));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("ASSESSMENT_TEST_DB_PASSWORD", ""));
        // The schema is applied out of band; never let the test rewrite it.
        registry.add("spring.flyway.enabled", () -> "false");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    }

    /**
     * Exactly what CopyCheckOrchestratorService does when it pre-creates the
     * per-question tracking rows: build without touching isEdited, then flush.
     * Before the fix this threw on the not-null constraint.
     */
    @Test
    void savesTrackingRowWithoutSettingIsEdited() {
        AiQuestionEvaluation row = trackingRow()
                .questionNumber(1)
                .build();

        // The flush is the assertion: this is the statement that threw in
        // production. Keep it ahead of the field checks so a regression surfaces
        // as the real constraint violation rather than a bare boolean mismatch.
        AiQuestionEvaluation saved = repository.saveAndFlush(row);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getIsEdited())
                .as("builder must default is_edited, the DB DEFAULT never fires on an explicit-column INSERT")
                .isFalse();
    }

    /**
     * A teacher override still has to win — the default must not overwrite an
     * explicitly set value.
     */
    @Test
    void keepsExplicitIsEditedValue() {
        AiQuestionEvaluation row = trackingRow()
                .questionNumber(2)
                .isEdited(true)
                .editedBy("teacher-1")
                .editedAt(new Date())
                .build();

        AiQuestionEvaluation saved = repository.saveAndFlush(row);

        assertThat(saved.getIsEdited()).isTrue();
        assertThat(saved.getEditedBy()).isEqualTo("teacher-1");
    }
}
