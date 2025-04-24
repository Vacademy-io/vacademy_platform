package vacademy.io.media_service.controller.pdf_convert;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.manager.AiLectureManager;

@RestController
@RequestMapping("/media-service/ai/lecture")
public class AiLectureController {

    @Autowired
    AiLectureManager aiLectureManager;

    @GetMapping("/generate-plan")
    public ResponseEntity<String> getLecturePlanner(@RequestParam("userPrompt") String userPrompt,
                                                    @RequestParam("lectureDuration") String lectureDuration,
                                                    @RequestParam(value = "language",required = false) String language,
                                                    @RequestParam(value = "methodOfTeaching",required = false) String methodOfTeaching,
                                                    @RequestParam("taskName") String taskName,
                                                    @RequestParam("instituteId") String instituteId,
                                                    @RequestParam(value = "level", required = false) String level){
        return aiLectureManager.generateLecturePlanner(userPrompt,lectureDuration,language,methodOfTeaching,taskName,instituteId,level);
    }
}
