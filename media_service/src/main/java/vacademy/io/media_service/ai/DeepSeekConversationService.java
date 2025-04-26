package vacademy.io.media_service.ai;

import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;

@Service
public class DeepSeekConversationService {

    @Autowired
    DeepSeekApiService deepSeekApiService;

    public String getResponseForUserPrompt(String userPrompt, String htmlText, String last5Conversations) {
        String template = """
                HTML raw data :  {htmlText}
                User Chat :  {userPrompt}
                Last 5 Conversations: {last5Conversation}
                    
                        Prompt:
                          - Use the "User Chat" to generate a meaningful response based on the HTML content.
                          - Utilize relevant information from the "Last 5 Conversations" (if available) to maintain conversational continuity.
                          - Preserve all DS_TAGs in HTML content in comments
                           
                           JSON format : 
                         
                                {{
                                   "user" : "{userPrompt}", 
                                   "response" : "String" //Include Response here 
                                }} 
                           
                        Also keep the DS_TAGS field intact in html                      
                        IMPORTANT: {userPrompt}
                        Give the response string in a formatted markdown format
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("userPrompt", userPrompt,
                "last5Conversation", last5Conversations,"htmlText",htmlText));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.0-flash-exp:free", prompt.getContents().trim(), 30000);
        if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
            throw new VacademyException("Failed To generate Response");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        return validJson;
    }
}
