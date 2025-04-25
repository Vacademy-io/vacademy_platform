package vacademy.io.media_service.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.audio.AudioConversionDeepLevelResponse;
import vacademy.io.media_service.service.DeepSeekAsyncTaskService;
import vacademy.io.media_service.service.FileConversionStatusService;
import vacademy.io.media_service.service.NewAudioConverterService;

@Component
public class AiLectureManager {

    @Autowired
    DeepSeekAsyncTaskService deepSeekAsyncTaskService;

    @Autowired
    FileConversionStatusService fileConversionStatusService;

    @Autowired
    NewAudioConverterService newAudioConverterService;

    public ResponseEntity<String> generateLecturePlanner(String userPrompt, String lectureDuration, String language, String methodOfTeaching, String taskName,String instituteId,String level) {
        deepSeekAsyncTaskService.processDeepSeekTaskInBackgroundWrapperForLecturePlanner(userPrompt,lectureDuration,language,methodOfTeaching, taskName,instituteId,level);
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> generateLectureFeedback(String audioId, String instituteId, String taskName) {

        AudioConversionDeepLevelResponse convertedAudioResponse = newAudioConverterService.getConvertedAudioResponse(audioId);
        if (convertedAudioResponse == null || convertedAudioResponse.getText() == null) {
            throw new VacademyException("File Still Processing");
        }

        fileConversionStatusService.updateHtmlText(audioId, convertedAudioResponse.getText());
        deepSeekAsyncTaskService.processDeepSeekTaskInBackgroundWrapperForLectureFeedback(convertedAudioResponse.getText(),convertedAudioResponse,instituteId,audioId,taskName);

        return ResponseEntity.ok("Done");
    }
}
