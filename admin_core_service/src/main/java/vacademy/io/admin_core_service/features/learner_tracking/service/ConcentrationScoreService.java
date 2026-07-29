package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ConcentrationScoreDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ConcentrationScore;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ConcentrationScoreRepository;
import vacademy.io.admin_core_service.features.learner_tracking.util.ConcentrationScoreCalculator;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConcentrationScoreService {
    private final ConcentrationScoreRepository concentrationScoreRepository;

    // Called as the last statement of the @Transactional activity writers.
    // It must never throw: an unchecked exception here rolls back the
    // activity log, breadcrumbs and engaged_ms that were just written — a
    // payload with no concentration block or a zero-length final flush (a
    // tab-close beacon) used to cost the learner that whole sync window.
    public void addConcentrationScore(ConcentrationScoreDTO concentrationScoreDTO, ActivityLog activityLog) {
        try {
            if (concentrationScoreDTO == null
                    || activityLog.getStartTime() == null
                    || activityLog.getEndTime() == null) {
                return; // keep whatever score row already exists
            }
            long activityDuration = activityLog.getEndTime().getTime() - activityLog.getStartTime().getTime();
            if (activityDuration <= 0) {
                return;
            }
            Double concentrationScoreValue = ConcentrationScoreCalculator.calculateConcentrationScore(
                    concentrationScoreDTO.getPauseCount(),
                    concentrationScoreDTO.getTabSwitchCount(),
                    concentrationScoreDTO.getAnswerTimesInSeconds(),
                    (int) (activityDuration / 1000));
            concentrationScoreRepository.deleteByActivityId(activityLog.getId());
            ConcentrationScore concentrationScore = new ConcentrationScore(java.util.UUID.randomUUID().toString(),
                    concentrationScoreValue, concentrationScoreDTO.getTabSwitchCount(),
                    concentrationScoreDTO.getPauseCount(), concentrationScoreDTO.getAnswerTimesInSeconds(),
                    activityLog);
            concentrationScoreRepository.save(concentrationScore);
        } catch (RuntimeException e) {
            log.warn("Skipping concentration score for activity {}: {}", activityLog.getId(), e.getMessage());
        }
    }
}
