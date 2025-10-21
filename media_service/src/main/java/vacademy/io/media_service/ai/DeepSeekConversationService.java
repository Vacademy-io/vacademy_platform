package vacademy.io.media_service.ai;

import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.constant.ConstantAiTemplate;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;

@Service
public class DeepSeekConversationService {

    @Autowired
    ExternalAIApiServiceImpl deepSeekApiService;

    public String getResponseForUserPrompt(String userPrompt, String htmlText, String last5Conversations) {
        String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.CHAT_WITH_PDF);

        Prompt prompt = new PromptTemplate(template).create(Map.of("userPrompt", userPrompt,
                "last5Conversation", last5Conversations, "htmlText", htmlText));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash-preview-09-2025", prompt.getContents().trim(), 30000);
        if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
            throw new VacademyException("Failed To generate Response");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        return validJson;
    }
}
