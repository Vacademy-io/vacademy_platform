package vacademy.io.admin_core_service.features.learner_tracking.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_tracking.dto.SlideInteractionDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.LearnerSlideInteraction;
import vacademy.io.admin_core_service.features.learner_tracking.repository.LearnerSlideInteractionRepository;

import java.util.List;
import java.util.UUID;

/**
 * Stores a learner's state for the interactive blocks inside a document slide
 * (checklist ticks, fill-in-the-blank answers, inline MCQ choices). Isolated
 * from activity/progress tracking; it persists what the learner did so it
 * survives reloads/devices and can be surfaced in the admin activity logs.
 */
@Service
public class LearnerSlideInteractionService {

    private final LearnerSlideInteractionRepository repository;

    public LearnerSlideInteractionService(LearnerSlideInteractionRepository repository) {
        this.repository = repository;
    }

    public List<SlideInteractionDTO> getInteractions(String userId, String slideId) {
        return repository.findByUserIdAndSlideId(userId, slideId).stream()
                .map(i -> new SlideInteractionDTO(i.getElementKey(), i.getElementType(), i.getStateJson()))
                .toList();
    }

    @Transactional
    public SlideInteractionDTO saveInteraction(String userId, String slideId, String elementKey,
            String elementType, String stateJson) {
        LearnerSlideInteraction entity = repository
                .findByUserIdAndSlideIdAndElementKey(userId, slideId, elementKey)
                .orElseGet(() -> {
                    LearnerSlideInteraction created = new LearnerSlideInteraction();
                    created.setId(UUID.randomUUID().toString());
                    created.setUserId(userId);
                    created.setSlideId(slideId);
                    created.setElementKey(elementKey);
                    return created;
                });
        entity.setElementType(elementType);
        entity.setStateJson(stateJson);
        repository.save(entity);
        return new SlideInteractionDTO(elementKey, elementType, stateJson);
    }
}
