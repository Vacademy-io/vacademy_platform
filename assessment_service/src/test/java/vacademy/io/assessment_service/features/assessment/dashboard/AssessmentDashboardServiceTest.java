package vacademy.io.assessment_service.features.assessment.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentCountResponse;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;

/**
 * The Overview tab must always come back with every block present: a failing
 * aggregate degrades to zeros for that block, nulls become zeros, percentages
 * are rounded, and the batch scope is passed through exactly.
 */
class AssessmentDashboardServiceTest {

        private AssessmentDashboardRepository dashboard;
        private AssessmentRepository assessments;
        private AssessmentDashboardService service;

        @BeforeEach
        void setUp() {
                dashboard = mock(AssessmentDashboardRepository.class);
                assessments = mock(AssessmentRepository.class);
                service = new AssessmentDashboardService(dashboard, assessments);
        }

        @Test
        void maps_every_block_and_rounds_percentages() {
                AssessmentCountResponse counts = mock(AssessmentCountResponse.class);
                when(counts.getLiveCount()).thenReturn(4);
                when(counts.getUpcomingCount()).thenReturn(0);
                when(counts.getPreviousCount()).thenReturn(21);
                when(counts.getDraftCount()).thenReturn(35);
                when(assessments.getAssessmentAllTypeCount("inst")).thenReturn(counts);

                AssessmentDashboardRepository.ParticipationRow part = mock(AssessmentDashboardRepository.ParticipationRow.class);
                when(part.getRegisteredLearners()).thenReturn(6L);
                when(part.getAttemptedLearners()).thenReturn(4L);
                when(part.getAttemptsTotal()).thenReturn(54L);
                when(part.getAttemptsLast7Days()).thenReturn(2L);
                when(part.getLiveAttempts()).thenReturn(null); // a null count is a zero, not a crash
                when(dashboard.participation(eq("inst"), eq(true), anyList())).thenReturn(part);

                AssessmentDashboardRepository.BatchRow batch = mock(AssessmentDashboardRepository.BatchRow.class);
                when(batch.getBatchId()).thenReturn("b1");
                when(batch.getAssessments()).thenReturn(17L);
                when(batch.getLearners()).thenReturn(3L);
                when(batch.getAttempts()).thenReturn(28L);
                when(batch.getAvgPercent()).thenReturn(48.129699);
                when(batch.getBestPercent()).thenReturn(100.0);
                when(batch.getLowestPercent()).thenReturn(null);
                when(dashboard.batchPerformance(eq("inst"), eq(true), anyList())).thenReturn(List.of(batch));
                when(dashboard.recentAssessments(anyString(), anyBoolean(), anyList(), anyInt())).thenReturn(List.of());

                AssessmentDashboardDto dto = service.overview("inst", null);

                assertThat(dto.getCounts().getLive()).isEqualTo(4);
                assertThat(dto.getCounts().getDraft()).isEqualTo(35);
                assertThat(dto.getParticipation().getRegisteredLearners()).isEqualTo(6);
                assertThat(dto.getParticipation().getLiveAttempts()).isZero();
                assertThat(dto.getBatches()).hasSize(1);
                assertThat(dto.getBatches().get(0).getAvgPercent()).isEqualTo(48.1);
                assertThat(dto.getBatches().get(0).getLowestPercent()).isNull();
                assertThat(dto.getPending()).isNotNull(); // repository returned null → zeros
                assertThat(dto.getPending().getResultsToRelease()).isZero();
                assertThat(dto.getGeneratedAt()).isNotNull();
        }

        @Test
        void a_failing_block_degrades_to_zeros_and_the_others_still_load() {
                when(assessments.getAssessmentAllTypeCount(anyString())).thenThrow(new RuntimeException("db"));
                when(dashboard.participation(anyString(), anyBoolean(), anyList())).thenThrow(new RuntimeException("db"));
                AssessmentDashboardRepository.PendingRow pending = mock(AssessmentDashboardRepository.PendingRow.class);
                when(pending.getManualEvaluationPending()).thenReturn(4L);
                when(dashboard.pending(anyString(), anyBoolean(), anyList())).thenReturn(pending);

                AssessmentDashboardDto dto = service.overview("inst", List.of());

                assertThat(dto.getCounts().getLive()).isZero();
                assertThat(dto.getParticipation().getAttemptsTotal()).isZero();
                assertThat(dto.getPending().getManualEvaluationPending()).isEqualTo(4);
                assertThat(dto.getBatches()).isEmpty();
                assertThat(dto.getAssessments()).isEmpty();
        }

        @Test
        void a_batch_scope_is_passed_through_and_an_empty_one_means_all() {
                service.overview("inst", List.of("b1", "b2"));
                verify(dashboard).participation("inst", false, List.of("b1", "b2"));
                verify(dashboard).recentAssessments(eq("inst"), eq(false), eq(List.of("b1", "b2")), anyInt());

                service.overview("inst", List.of());
                verify(dashboard).participation(eq("inst"), eq(true), any());
        }
}
