package vacademy.io.media_service.ai;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class DeepSeekService {

    private final ChatModel chatModel;

    @Autowired
    public DeepSeekService(ChatModel chatModel) {
        this.chatModel = chatModel;
    }



    public String getQuestionsWithDeepSeekFromHTML(String htmlData) {

        String template = """
    HTML raw data :  {htmlData}
    
            Prompt:
            Convert the given HTML file containing questions into the following JSON format:
                    {{
                             "questions": [
                                 {{
                                     "question_number": "number",
                                     "question": {{
                                         "type": "HTML",
                                         "content": "string" // Include img tags if present
                                     }},
                                     "options": [
                                         {{
                                             "type": "HTML",
                                             "content": "string" // Include img tags if present
                                         }}
                                     ],
                                     "correct_options": "number[]",
                                     "ans": "string",
                                     "exp": "string",
                                     "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER | NUMERIC",
                                     "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                                     "level": "easy | medium | hard"
                                 }}
                             ],
                             "title": "string" // Suitable title for the question paper
                         }}
                
            For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
            - Leave 'correct_options' empty but fill 'ans' and 'exp'
            - Omit 'options' field entirely
            """;
            
        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlData", htmlData));

        ChatResponse response = chatModel.call(
                prompt);
            
        return response.getResult().getOutput().toString();
    }
}