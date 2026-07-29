package vacademy.io.admin_core_service.features.learner_operation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_operation.entity.LearnerOperation;
import vacademy.io.admin_core_service.features.learner_operation.repository.LearnerOperationRepository;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LearnerOperationService {

    private final LearnerOperationRepository learnerOperationRepository;

    public void deleteLearnerOperationByUserIdSourceAndSourceIdAndOperation(String userId, String source, String sourceId, String operation) {
        learnerOperationRepository.deleteBySourceAndSourceIdAndOperationAndUserId(source,sourceId,operation,userId);
    }
    // Atomic upsert (ON CONFLICT on the V409 unique key). The previous
    // find-then-save raced under the async cascade: two concurrent rollups for
    // the same learner either lost an update or inserted a duplicate row.
    @Transactional
    public void addOrUpdateOperation(String userId, String source, String sourceId, String operation, String value) {
        learnerOperationRepository.upsertOperation(
                UUID.randomUUID().toString(), userId, source, sourceId, operation, value);
    }

    private Optional<LearnerOperation> findByUserIdSourceAndSourceIdAndOperation(String userId, String source, String sourceId, String operation) {
        return learnerOperationRepository.findByUserIdAndSourceAndSourceIdAndOperation(userId, source, sourceId, operation);
    }

    public Optional<Double> findDoubleValueByUserIdSourceAndSourceIdAndOperation(
            String userId, String source, String sourceId, String operation) {
        return findByUserIdSourceAndSourceIdAndOperation(userId, source, sourceId, operation)
                .map(LearnerOperation::getValue)
                .filter(v -> v != null && v.matches("^-?\\d+(\\.\\d+)?$"))
                .map(Double::parseDouble);
    }
}
