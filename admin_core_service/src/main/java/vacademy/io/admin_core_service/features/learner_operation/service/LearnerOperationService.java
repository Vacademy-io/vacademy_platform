package vacademy.io.admin_core_service.features.learner_operation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_operation.entity.LearnerOperation;
import vacademy.io.admin_core_service.features.learner_operation.repository.LearnerOperationRepository;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LearnerOperationService {

    private final LearnerOperationRepository learnerOperationRepository;

    public void deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(String userId, String source, String sourceId, String operation) {
        learnerOperationRepository.deleteBySourceAndSourceIdAndOperationAndUserId(source,sourceId,operation,userId);
    }
    public void addOrUpdateOperation(String userId, String source, String sourceId, String operation, String value) {
        Optional<LearnerOperation> existingOperation = findByUserIdSourceAndSourceIdAndOperation(userId, source, sourceId, operation);

        if (existingOperation.isPresent()) {
            LearnerOperation operationEntity = existingOperation.get();
            operationEntity.setValue(value);
            learnerOperationRepository.save(operationEntity);
        } else {
            LearnerOperation newOperation = new LearnerOperation(userId, source, sourceId, operation, value);
            learnerOperationRepository.save(newOperation);
        }
    }

    private Optional<LearnerOperation> findByUserIdSourceAndSourceIdAndOperation(String userId, String source, String sourceId, String operation) {
        return learnerOperationRepository.findByUserIdAndSourceAndSourceIdAndOperation(userId, source, sourceId, operation);
    }
}
