package vacademy.io.media_service.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.entity.TaskStatusEnum;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
public class DeepSeekLectureService {

    @Autowired
    private DeepSeekApiService deepSeekApiService;

    @Autowired
    TaskStatusService taskStatusService;


    public String generateLecturePlannerFromPrompt(String userPrompt, String lectureDuration, String language, String methodOfTeaching, TaskStatus taskStatus,String level,Integer attempt) {
        log.info("attempt: " + attempt);
        if(attempt>=3){
            throw new VacademyException("No response from DeepSeek");
        }
        try{
            String template = """
                        User Prompt: {userPrompt}
                        Lecture Duration: {lectureDuration}
                        language: {language}
                        Method Of Teaching: {methodOfTeaching}
                        Class Level: {level}
                        
                        Prompt:
                         -Generate a Lecture Plan Using User Prompt and follow the {methodOfTeaching} method with following Json Format:
                         -Planing should be of {lectureDuration} in {language} and Class Level is {level}.
                         
                         
                        Json Format:
                            {{
                               "heading":"String",  //Provide Heading of the Lecture
                               "mode": {methodOfTeaching},    
                               "duration": {lectureDuration},
                               "language": {language},
                               "level": {level},
                               "timeWiseSplit":[
                                               {{ 
                                                   "sectionHeading": "String" //Include section heading
                                                   "timeSplit":"String",   //Include Splitted Time e.g - 1-5mins, 2-10mins (Split the time according to the section) more time for more important section and less time for less important section
                                                   "content":"String",     //Provide a long, content as if a teacher is explaining it to {level} students in class. The explanation must be detailed enough to cover the entire allocated time slot (e.g. for 1-10 mins, write 500+ words). Use simple, engaging language, examples, analogies to explain the topic clearly and interestingly.
                                                   "topicCovered":["String"],  //Include the topic covered in this section
                                                   "questionToStudents":["String"],  //Include Question which should be asked to students during teaching this section
                                                   "activity":["String"]  //Include activities which can be performed during teaching this section if possible
                                                }}
                                                ],
                               "assignment":{{
                                               "topicCovered":["String"], //Include topic covered in assignments
                                               "tasks":["String"], //Include Tasks which student have to complete as Homework
                                             }},
                               "summary": ["String"]   //Provide summary of the lecture plan (Not the summary of topic but the plan)
                            }}
                            
                            
                            Rules To be followed while generating plan:
                            - timeWiseSplit should cover {lectureDuration}
                            - content in each timeWiseSplit should be descriptive and it should cover the timeSplit 
                            
                            Important: {userPrompt}
                        """;

            Prompt prompt = new PromptTemplate(template)
                    .create(Map.of("userPrompt", userPrompt,
                    "language", (language == null || language.isEmpty()) ? "en" : language,
                    "lectureDuration",lectureDuration,
                    "methodOfTeaching",(methodOfTeaching == null || methodOfTeaching.isEmpty()) ? "Concept First" : methodOfTeaching,
                    "level",level));

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
            if(Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                return generateLecturePlannerFromPrompt(userPrompt,lectureDuration,language,methodOfTeaching,taskStatus,level,attempt+1);
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), validJson);

            return validJson;
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), e.getMessage());
            throw new VacademyException("Failed to generate: " +e.getMessage());
        }
    }

    public String generateLectureFeedback(String text, String convertedAudioResponseString, TaskStatus taskStatus, int attempt, String audioPace) {

        if(attempt>=3){
            throw new VacademyException("No response from DeepSeek");
        }
        try{
            String template = """
                            Spoken Text : {text}
                            Spoken Text quality : {convertedAudioResponseString}
                            Pace: {audioPace} WordsPerMinute
                        
                            Prompt:
                              - Generate a Lecture FeedBack From the Spoken Text And Spoken Text quality with Pace speed in following json format:
                              - The Overall score generated should be strictly less than or equal to 100;
                              - Generate report based on following criteria Only:
                                      -Delivery & Presentation(20 Points)
                                      -Content Quality(20 Points)
                                      -Student Engagement(15 Points)
                                      -Assessment & Feedback(10 Points)
                                      -Inclusivity & Language(10 Points)
                                      -Classroom Management(10 Points)
                                      -Teaching Aids(10 Points)
                                      -Professionalism(5 Points)
                              -Strictly Follow Max marks for each criteria and do not create more criteria than mentioned

                              
                              Strict Json Format: 
                              
                                   {{
                                 "title": "String",   //Include Title of the Spoken Text
                                 "reportTitle": "String", 
                                 "lectureInfo": {{
                                   "lectureTitle": "String",  //Provide the lecture Title For Spoken Text
                                   "duration": "String",  //Provide the duration of the lecture
                                   "evaluationDate": "String"  //Provide the Today's Date
                                 }},
                                 "totalScore": "String",   //Include Total Score Generated(Should not exceed 100)
                                 "criteria": [  //Only Include mention criteria
                                   {{
                                     "name": "String",
                                     "score": "String",
                                     "points": [
                                       {{
                                         "title": "String",   
                                         "description": ["String"]  //Include description in very simple and understandable form
                                       }}
                                     ],
                                       {{
                                          "scopeOfImprovement":["String"] //Include Scope of improvement If Any
                                       }}
                                   }}
                                 ],
                                 "summary":["String"]   //Include Summary of overall report
                               }}
                    
                        """;

            Prompt prompt = new PromptTemplate(template)
                    .create(Map.of("text",text,
                            "convertedAudioResponseString",convertedAudioResponseString,
                            "audioPace",audioPace));

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
            if(Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty() || response.getChoices().get(0).getMessage().getContent().isEmpty()) {
                return generateLectureFeedback(text,convertedAudioResponseString,taskStatus,attempt+1, audioPace);
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), validJson);

            return validJson;
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), e.getMessage());
            throw new VacademyException("Failed to generate: " +e.getMessage());
        }
    }
}
