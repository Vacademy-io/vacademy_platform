package vacademy.io.media_service.manager;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
         * 
         * @param userPrompt       The topic/content for the lecture
         * @param lectureDuration  Duration of the lecture
         * @param language         Language for the lecture plan
         * @param methodOfTeaching Teaching method
         * @param taskName         Name for tracking this task
         * @param instituteId      Institute identifier
         * @param level            Class/skill level
         * @param model            AI model to use
         * @return Task ID for tracking progress
         */
        public String generateLecturePlanner(
                        String userPrompt,
                        String lectureDuration,
                        String language,
                        String methodOfTeaching,
                        String taskName,
                        String instituteId,
                        String level,
                        String model) {

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
                                level,
                                model);

                log.info("Started lecture planner generation: taskId={}, model={}", taskStatus.getId(), model);
                return taskStatus.getId();
        }

        /**
         * Generates feedback for a lecture from audio transcription.
         * 
         * @param audioId     The audio file ID
         * @param instituteId Institute identifier
         * @param taskName    Name for tracking this task
         * @param model       AI model to use
         * @return Task ID for tracking progress
         */
        public String generateLectureFeedback(
                        String audioId,
                        String instituteId,
                        String taskName,
                        String model) {

                TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                                null,
                                TaskStatusTypeEnum.LECTURE_FEEDBACK.name(),
                                audioId,
                                TaskInputTypeEnum.AUDIO_ID.name(),
                                taskName,
                                instituteId);

                deepSeekAsyncTaskService.pollAndProcessAudioFeedback(taskStatus, audioId, model);

                log.info("Started lecture feedback generation: taskId={}, audioId={}, model={}",
                                taskStatus.getId(), audioId, model);
                return taskStatus.getId();
        }
}
