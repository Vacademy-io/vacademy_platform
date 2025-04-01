package vacademy.io.assessment_service.features.assessment.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.dto.EvaluationLogDto;
import vacademy.io.assessment_service.features.assessment.entity.EvaluationLogs;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.EvaluationLogSourceEnum;
import vacademy.io.assessment_service.features.assessment.repository.EvaluationLogsRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Component
public class AdminEvaluationLogsManager {

    @Autowired
    StudentAttemptService studentAttemptService;

    @Autowired
    EvaluationLogsRepository evaluationLogsRepository;

    public ResponseEntity<List<EvaluationLogDto>> getEvaluationLogs(CustomUserDetails userDetails, String attemptId) {
        List<EvaluationLogDto> allLogsDto = new ArrayList<>();

        List<EvaluationLogs> allLogs = evaluationLogsRepository.findAllBySourceAndSourceIdOrderByDateAndTimeDesc(EvaluationLogSourceEnum.STUDENT_ATTEMPT.name(), attemptId);

        allLogs.forEach(log->{
            allLogsDto.add(log.getEvaluationDto());
        });

        return ResponseEntity.ok(allLogsDto);
    }
}
