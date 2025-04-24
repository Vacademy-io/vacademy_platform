package vacademy.io.media_service.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.media_service.ai.DeepSeekLectureService;
import vacademy.io.media_service.ai.DeepSeekService;
import vacademy.io.media_service.service.DeepSeekAsyncTaskService;

@Component
public class AiLectureManager {

    @Autowired
    DeepSeekAsyncTaskService deepSeekAsyncTaskService;

    public ResponseEntity<String> generateLecturePlanner(String userPrompt, String lectureDuration, String language, String methodOfTeaching, String taskName,String instituteId,String level) {
        deepSeekAsyncTaskService.processDeepSeekTaskInBackgroundWrapperForLecturePlanner(userPrompt,lectureDuration,language,methodOfTeaching, taskName,instituteId,level);
        return ResponseEntity.ok("Done");
    }
}
