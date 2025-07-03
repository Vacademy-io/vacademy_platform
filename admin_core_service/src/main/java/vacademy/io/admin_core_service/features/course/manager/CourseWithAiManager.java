package vacademy.io.admin_core_service.features.course.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import vacademy.io.admin_core_service.features.course.constant.CoursePromptTemplate;
import vacademy.io.admin_core_service.features.course.dto.CourseUserPrompt;
import vacademy.io.admin_core_service.features.course.service.OpenRouterService;


import java.util.Map;

@Slf4j
@Component
public class CourseWithAiManager {

    private final OpenRouterService openRouterService;

    public CourseWithAiManager(OpenRouterService openRouterService) {
        this.openRouterService = openRouterService;
    }

    /**
     * Generates a course outline by streaming a response from the AI service.
     * @return A Flux<String> that emits content chunks as they are received.
     */
    public Flux<String> generateCourseWithAi(String instituteId, CourseUserPrompt courseUserPrompt) {
        String template = CoursePromptTemplate.getGenerateCourseWithAiTemplate();
        Map<String, Object> promptMap = Map.of("userPrompt", courseUserPrompt.getUserPrompt());
        String finalPrompt = applyTemplateVariables(template, promptMap);

        // This now returns a Flux<String> and does not collect the results.
        return openRouterService.streamAnswer(finalPrompt);
    }

    public static String applyTemplateVariables(String template, Map<String, Object> promptMap) {
        for (Map.Entry<String, Object> entry : promptMap.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = String.valueOf(entry.getValue());
            template = template.replace(placeholder, value);
        }
        return template;
    }
}
