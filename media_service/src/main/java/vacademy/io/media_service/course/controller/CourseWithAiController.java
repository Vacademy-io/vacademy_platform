package vacademy.io.media_service.course.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import vacademy.io.media_service.course.dto.CourseUserPrompt;
import vacademy.io.media_service.course.manager.CourseWithAiManager;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/media-service/course/ai/v1")
public class CourseWithAiController {

    private final CourseWithAiManager courseWithAiManager;

    public CourseWithAiController(CourseWithAiManager courseWithAiManager) {
        this.courseWithAiManager = courseWithAiManager;
    }


    @PostMapping(value = "/generate", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    Flux<String> generateCourse(@RequestBody CourseUserPrompt courseUserPrompt,
                                @RequestParam("instituteId") String instituteId,
                                @RequestParam("model") String model){
        // The manager now returns a Flux, which is directly returned to the client.
        // Spring WebFlux will handle sending each piece of data as it arrives.
        try{
            return courseWithAiManager.generateCourseWithAi( instituteId, courseUserPrompt, model);


        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
