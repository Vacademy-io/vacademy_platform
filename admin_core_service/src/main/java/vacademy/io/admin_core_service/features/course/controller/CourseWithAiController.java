package vacademy.io.admin_core_service.features.course.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import vacademy.io.admin_core_service.features.course.dto.CourseUserPrompt;
import vacademy.io.admin_core_service.features.course.manager.CourseWithAiManager;

import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/course/ai/v1")
public class CourseWithAiController {

    private final CourseWithAiManager courseWithAiManager;

    public CourseWithAiController(CourseWithAiManager courseWithAiManager) {
        this.courseWithAiManager = courseWithAiManager;
    }


    @PostMapping(value = "/generate", produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<String> generateCourse(@RequestBody CourseUserPrompt courseUserPrompt,
                                          @RequestParam("instituteId") String instituteId){
        // The manager now returns a Flux, which is directly returned to the client.
        // Spring WebFlux will handle sending each piece of data as it arrives.
        try{
            Flux<String> response =  courseWithAiManager.generateCourseWithAi( instituteId, courseUserPrompt);
            return ResponseEntity.ok(response.collect(Collectors.joining()).block());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
