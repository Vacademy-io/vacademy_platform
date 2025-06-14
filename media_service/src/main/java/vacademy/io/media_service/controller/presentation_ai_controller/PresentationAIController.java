package vacademy.io.media_service.controller.presentation_ai_controller;


import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekApiService;
import vacademy.io.media_service.constant.ConstantAiTemplate;
import vacademy.io.media_service.dto.AutoDocumentSubmitResponse;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.dto.FileIdSubmitRequest;
import vacademy.io.media_service.dto.PresentationAiGenerateRequest;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/media-service/ai/presentation")
public class PresentationAIController {

    @Autowired
    DeepSeekApiService deepSeekApiService;

    @PostMapping("/generateFromData")
    public ResponseEntity<String> generateFromData(@RequestBody PresentationAiGenerateRequest presentationAiGenerateRequest) {

        try {
            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.PRESENTATION_AI_GENERATE);

            Prompt prompt = new PromptTemplate(template).create(Map.of("language", presentationAiGenerateRequest.getLanguage(),
                    "inputText", presentationAiGenerateRequest.getText()));

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-pro-preview", prompt.getContents().trim(), 40000);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                throw new VacademyException("Failed To generate Response");
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
            return ResponseEntity.ok(validJson);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @PostMapping("/regenerateASlide")
    public ResponseEntity<String> regenerateASlide(@RequestBody PresentationAiGenerateRequest presentationAiGenerateRequest) {

        try {
            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.PRESENTATION_AI_REGENERATE_SLIDE);

            Prompt prompt = new PromptTemplate(template).create(Map.of("initialData", presentationAiGenerateRequest.getInitialData(),
                    "text", presentationAiGenerateRequest.getText()));
            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-pro-preview", prompt.getContents().trim(), 40000);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                throw new VacademyException("Failed To generate Response");
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
            return ResponseEntity.ok(validJson);

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }
}
