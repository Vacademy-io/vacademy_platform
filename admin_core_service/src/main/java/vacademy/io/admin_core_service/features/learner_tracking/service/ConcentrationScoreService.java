package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ConcentrationScoreDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ConcentrationScore;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ConcentrationScoreRepository;
import vacademy.io.admin_core_service.features.learner_tracking.util.ConcentrationScoreCalculator;

@Service
@RequiredArgsConstructor
public class ConcentrationScoreService {
    private final ConcentrationScoreRepository concentrationScoreRepository;

    public void addConcentrationScore(ConcentrationScoreDTO concentrationScoreDTO, ActivityLog activityLog) {
        concentrationScoreRepository.deleteByActivityId(activityLog.getId());
        long activityDuration = activityLog.getEndTime().getTime() - activityLog.getStartTime().getTime();
        if (activityDuration <= 0) {
            throw new IllegalArgumentException("Invalid activity duration");
        }
        Double concentrationScoreValue = ConcentrationScoreCalculator.calculateConcentrationScore(
                concentrationScoreDTO.getPauseCount(),
                concentrationScoreDTO.getTabSwitchCount(),
                concentrationScoreDTO.getAnswerTimesInSeconds(),
                (int) (activityDuration / 1000) // Convert milliseconds to seconds
        );
        ConcentrationScore concentrationScore = new ConcentrationScore(concentrationScoreDTO.getId(), concentrationScoreValue, concentrationScoreDTO.getTabSwitchCount(), concentrationScoreDTO.getPauseCount(), concentrationScoreDTO.getAnswerTimesInSeconds(), activityLog);
        concentrationScoreRepository.save(concentrationScore);
    }
}
