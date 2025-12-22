package vacademy.io.media_service.manager;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.service.DeepSeekAsyncTaskService;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.IdGenerationUtils;

/**
 * Manager for AI lecture-related operations.
 * Handles lecture planning and feedback generation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiLectureManager {

        private final DeepSeekAsyncTaskService deepSeekAsyncTaskService;
        private final TaskStatusService taskStatusService;

        /**
         * Generates a lecture plan based on user input.
         */
        public ResponseEntity<String> generateLecturePlanner(
                        String userPrompt,
                        String lectureDuration,
                        String language,
                        String methodOfTeaching,
                        String taskName,
                        String instituteId,
                        String level) {

                TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                                null,
                                TaskStatusTypeEnum.LECTURE_PLANNER.name(),
                                IdGenerationUtils.generateUniqueId(userPrompt),
                                TaskInputTypeEnum.PROMPT_ID.name(),
                                taskName,
                                instituteId);

                deepSeekAsyncTaskService.processDeepSeekTaskInBackgroundWrapperForLecturePlanner(
                                taskStatus,
                                userPrompt,
                                lectureDuration,
                                language,
                                methodOfTeaching,
                                level);

                log.info("Started lecture planner generation: taskId={}", taskStatus.getId());
                return ResponseEntity.ok(taskStatus.getId());
        }

        /**
         * Generates feedback for a lecture from audio transcription.
         */
        public ResponseEntity<String> generateLectureFeedback(
                        String audioId,
                        String instituteId,
                        String taskName) {

                TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                                null,
                                TaskStatusTypeEnum.LECTURE_FEEDBACK.name(),
                                audioId,
                                TaskInputTypeEnum.AUDIO_ID.name(),
                                taskName,
                                instituteId);

                deepSeekAsyncTaskService.pollAndProcessAudioFeedback(taskStatus, audioId);

                log.info("Started lecture feedback generation: taskId={}, audioId={}", taskStatus.getId(), audioId);
                return ResponseEntity.ok(taskStatus.getId());
        }
}
