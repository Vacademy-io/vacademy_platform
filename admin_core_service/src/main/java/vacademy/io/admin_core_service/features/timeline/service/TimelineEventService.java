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
         * studentUserId is optional — pass null for non-student-linked events.
         */
        @Transactional
        public void logEvent(String type, String typeId, String actionType,
                        String actorType, String actorId, String actorName,
                        String title, String description, Object metadata) {
                logEvent(type, typeId, actionType, actorType, actorId, actorName,
                        title, description, metadata, null);
        }

        /**
         * Internal method to log a timeline event with optional student user ID for cross-stage continuity.
         */
        @Transactional
        public void logEvent(String type, String typeId, String actionType,
                        String actorType, String actorId, String actorName,
                        String title, String description, Object metadata,
                        String studentUserId) {

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
                                .studentUserId(studentUserId)
                                .build();

                timelineEventRepository.save(event);
                logger.debug("Logged timeline event: {} on {}[{}]", actionType, type, typeId);
        }

        /**
         * Create a manual timeline event (used by the controller for frontend-submitted
         * actions like notes, call logs, follow-ups).
         */
        @Transactional
        public TimelineEventDTO createManualEvent(TimelineEventRequestDTO request, CustomUserDetails user) {

                String actorId = user.getUserId();
                String actorName = user.getUsername();
                String actorType = "ADMIN";

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
                                .isPinned(request.getIsPinned() != null ? request.getIsPinned() : false)
                                .studentUserId(request.getStudentUserId())
                                .build();

                TimelineEvent savedEvent = timelineEventRepository.save(event);
                return mapToDTO(savedEvent);
        }

        /**
         * Fetch timeline events for an entity (original — backward compatible).
         */
        @Transactional(readOnly = true)
        public Page<TimelineEventDTO> getTimelineEvents(String type, String typeId, Pageable pageable) {
                Page<TimelineEvent> events = timelineEventRepository.findByTypeAndTypeIdOrderByCreatedAtDesc(type,
                                typeId, pageable);
                return events.map(this::mapToDTO);
        }

        /**
         * Fetch timeline events for an entity, with pinned notes first.
         */
        @Transactional(readOnly = true)
        public Page<TimelineEventDTO> getTimelineEventsWithPinnedFirst(String type, String typeId, Pageable pageable) {
                Page<TimelineEvent> events = timelineEventRepository
                                .findByTypeAndTypeIdOrderByIsPinnedDescCreatedAtDesc(type, typeId, pageable);
                return events.map(this::mapToDTO);
        }

        /**
         * Fetch ALL timeline events for a student across all stages (cross-stage notes).
         * Pinned notes appear first.
         */
        @Transactional(readOnly = true)
        public Page<TimelineEventDTO> getCrossStageTimeline(String studentUserId, Pageable pageable) {
                Page<TimelineEvent> events = timelineEventRepository
                                .findByStudentUserIdOrderByIsPinnedDescCreatedAtDesc(studentUserId, pageable);
                return events.map(this::mapToDTO);
        }

        /**
         * Toggle pin status on a timeline event.
         * Returns the updated event.
         */
        @Transactional
        public TimelineEventDTO togglePin(String eventId) {
                TimelineEvent event = timelineEventRepository.findById(eventId)
                                .orElseThrow(() -> new VacademyException("Timeline event not found: " + eventId));

                event.setIsPinned(event.getIsPinned() != null ? !event.getIsPinned() : true);
                TimelineEvent saved = timelineEventRepository.save(event);
                return mapToDTO(saved);
        }

        private TimelineEventDTO mapToDTO(TimelineEvent event) {
                Object metadata = null;
                if (event.getMetadataJson() != null) {
                        try {
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
                                .isPinned(event.getIsPinned() != null ? event.getIsPinned() : false)
                                .studentUserId(event.getStudentUserId())
                                .createdAt(event.getCreatedAt())
                                .build();
        }
}
