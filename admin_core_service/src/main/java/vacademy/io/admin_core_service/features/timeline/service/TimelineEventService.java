package vacademy.io.admin_core_service.features.timeline.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventDTO;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventRequestDTO;
import vacademy.io.admin_core_service.features.timeline.entity.TimelineEvent;
import vacademy.io.admin_core_service.features.timeline.repository.TimelineEventRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

@Service
public class TimelineEventService {

        private static final Logger logger = LoggerFactory.getLogger(TimelineEventService.class);

        @Autowired
        private TimelineEventRepository timelineEventRepository;

        @Autowired
        private ObjectMapper objectMapper;

        /**
         * Internal method to log a timeline event from other services.
         */
        @Transactional
        public void logEvent(String type, String typeId, String actionType,
                        String actorType, String actorId, String actorName,
                        String title, String description, Object metadata) {

                String metadataJson = null;
                if (metadata != null) {
                        try {
                                metadataJson = objectMapper.writeValueAsString(metadata);
                        } catch (JsonProcessingException e) {
                                logger.error("Failed to parse metadata to JSON for timeline event", e);
                        }
                }

                TimelineEvent event = TimelineEvent.builder()
                                .type(type)
                                .typeId(typeId)
                                .actionType(actionType)
                                .actorType(actorType)
                                .actorId(actorId)
                                .actorName(actorName)
                                .title(title)
                                .description(description)
                                .metadataJson(metadataJson)
                                .build();

                timelineEventRepository.save(event);
                logger.debug("Logged timeline event: {} on {}[{}]", actionType, type, typeId);
        }

        /**
         * Create a manual timeline event (used by the controller for frontend-submitted
         * actions).
         */
        @Transactional
        public TimelineEventDTO createManualEvent(TimelineEventRequestDTO request, CustomUserDetails user) {

                String actorId = user.getUserId();
                String actorName = user.getUsername(); // Can also be full name depending on what's available
                String actorType = "ADMIN"; // For now assume ADMIN or system user, could customize based on roles

                String metadataJson = null;
                if (request.getMetadata() != null) {
                        try {
                                metadataJson = objectMapper.writeValueAsString(request.getMetadata());
                        } catch (JsonProcessingException e) {
                                throw new VacademyException("Invalid metadata format provided.");
                        }
                }

                TimelineEvent event = TimelineEvent.builder()
                                .type(request.getType())
                                .typeId(request.getTypeId())
                                .actionType(request.getActionType())
                                .actorType(actorType)
                                .actorId(actorId)
                                .actorName(actorName)
                                .title(request.getTitle())
                                .description(request.getDescription())
                                .metadataJson(metadataJson)
                                .build();

                TimelineEvent savedEvent = timelineEventRepository.save(event);
                return mapToDTO(savedEvent);
        }

        /**
         * Fetch timeline events for an entity.
         */
        @Transactional(readOnly = true)
        public Page<TimelineEventDTO> getTimelineEvents(String type, String typeId, Pageable pageable) {
                Page<TimelineEvent> events = timelineEventRepository.findByTypeAndTypeIdOrderByCreatedAtDesc(type,
                                typeId, pageable);
                return events.map(this::mapToDTO);
        }

        private TimelineEventDTO mapToDTO(TimelineEvent event) {
                Object metadata = null;
                if (event.getMetadataJson() != null) {
                        try {
                                // Parse the JSON string back to a generic object/map so the frontend receives
                                // real JSON instead of a string
                                metadata = objectMapper.readValue(event.getMetadataJson(), Object.class);
                        } catch (JsonProcessingException e) {
                                logger.error("Failed to deserialize metadata JSON", e);
                        }
                }

                return TimelineEventDTO.builder()
                                .id(event.getId())
                                .type(event.getType())
                                .typeId(event.getTypeId())
                                .actionType(event.getActionType())
                                .actorType(event.getActorType())
                                .actorId(event.getActorId())
                                .actorName(event.getActorName())
                                .title(event.getTitle())
                                .description(event.getDescription())
                                .metadata(metadata)
                                .createdAt(event.getCreatedAt())
                                .build();
        }
}
