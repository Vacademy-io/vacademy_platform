package vacademy.io.media_service.constant;

import vacademy.io.media_service.enums.TaskStatusTypeEnum;

public class ConstantAiTemplate {

    private static String getTextToQuestionTemplate() {

        return """
                Text raw prompt :  {textPrompt}
                Already Generated Questions: {allQuestionNumbers}
                    
                        Prompt:
                        use the Text raw prompt to generate {numberOfQuestions} {typeOfQuestion} questions for the class level {classLevel} and topics {topics} in {language}, return the output in JSON format as follows:
                         - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                         - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                         - Do not generate any questions if already generated {numberOfQuestions} questions and set is_process_completed true.
                         - Preserve all DS_TAGs in HTML content in comments
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
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER | NUMERIC",  //Strictly Include question_type
                                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                                                 "level": "easy | medium | hard"
                                             }}
                                         ],
                                         "title": "string" // Suitable title for the question paper ,
                                          "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "difficulty": "easy | medium | hard",
                                         "is_process_completed": true,false
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                    
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        """;
    }

    public static String getTemplateBasedOnType(TaskStatusTypeEnum type) {
        return switch (type) {
            case AUDIO_TO_QUESTIONS -> getAudioToQuestionTemplate();
            case PDF_TO_QUESTIONS_WITH_TOPIC -> getPdfToQuestionWithTopicTemplate();
            case PDF_TO_QUESTIONS, IMAGE_TO_QUESTIONS -> getPdfToQuestionTemplate();
            case TEXT_TO_QUESTIONS -> getTextToQuestionTemplate();
            case EVALUATION -> getmanualEvaluationTemplate();
            case LECTURE_PLANNER -> getLecturePlannerTemplate();
            case LECTURE_FEEDBACK -> getLectureFeedbackTemplate();
            case SORT_QUESTIONS_TOPIC_WISE -> getSortQuestionsTopicWiseTemplate();
            case CHAT_WITH_PDF -> getChatWithPdfTemplate();
            case HTML_TO_QUESTIONS -> getHtmlToQuestionTemplate();
        };
    }

    private static String getHtmlToQuestionTemplate() {
        return """
                HTML raw data :  {htmlData}
                    
                        Prompt:
                        Convert the given HTML file containing questions into the following JSON format:
                        - Preserve all DS_TAGs in HTML content in comments
                        
                        JSON format : 
                        
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
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        Also keep the DS_TAGS field intact in html
                        And do not try to calculate right ans, only add if available in input
                        
                        IMPORTANT: {userPrompt}
                """;
    }

    private static String getChatWithPdfTemplate() {
        return """
                                HTML raw data :  {htmlText}
                                User Chat :  {userPrompt}
                                Last 5 Conversations: {last5Conversation}
                                   \s
                                        Prompt:
                                          - Use the "User Chat" to generate a meaningful response based on the HTML content.
                                          - Utilize relevant information from the "Last 5 Conversations" (if available) to maintain conversational continuity
                                          \s
                                           JSON format :\s
                                        \s
                                                {{
                                                   "user" : "{userPrompt}",\s
                                                   "response" : "String" //Include Response here in well formatted html format
                                                }}\s
                                          \s
                                                 \s
                                        IMPORTANT: {userPrompt}
                                        Give the response string in a formatted html format
                """;
    }

    private static String getSortQuestionsTopicWiseTemplate() {
        return """
                        HTML raw data :  {htmlData}
                        Already extracted question numbers: {extractedQuestionNumber}
                               \s
                        Prompt:
                        Extract all questions from pdf and map all the extracted questions with respective topic and strictly follow Json Format:
                         - Strictly follow this: Do not repeat same question number in two or more topics
                         - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                         - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                         - Do not extract any questions if already extracted all questions and set is_process_completed true.
                         - Preserve all DS_TAGs in HTML content in comments
                       \s
                        JSON format :\s
                       \s
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
                                            "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // must include topic name
                                            "level": "easy | medium | hard"
                                        }}
                                    ],
                                    "title": "string", // Suitable title for the question paper
                                    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // multiple chapter and topic names for question paper
                                    "difficulty": "easy | medium | hard",
                                    "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"], // multiple subject names for question paper
                                    "classes": ["class 1", "class 2", "class 3", "class 4", "class 5", "class 6", "class 7", "class 8", "class 9", "class 10", "class 11", "class 12", "engineering", "medical", "commerce", "law"],
                                    "is_process_completed" : true,false // Ensure is_process_completed is set to true only if {userPrompt} is achieved,
                                    "topicQuestionMap":{{
                                                           "topic" : "String"       //Included Topic which are possible in pdf
                                                           "questionNumbers": [number]  //Include all the question numbers which is related to "topic"
                                                       }}
                                }}
                       \s
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                       \s
                        Tagging Rules:
                        - Every question must include its topic in the "tags" field.
                        - Questions belonging to the same topic must have identical "tags".
                        - If a topic is not directly extractable from the question, use headings or context from the HTML.
                       \s
                        Also keep the DS_TAGS field intact in HTML.
                        Do not try to calculate correct answers — only include if already available in the input.
                       \s
                """;
    }

    private static String getLectureFeedbackTemplate() {
        return """
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
    }

    private static String getLecturePlannerTemplate() {
        return """
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
    }

    private static String getmanualEvaluationTemplate() {
        return """
                Question :  {htmlQuestionData}
                                
                Answer By Student :  {htmlAnswerData}
                                
                Maximum Marks :{maxMarks}
                                
                Evaluation Difficulty :{evaluationDifficulty}
                    
                        Prompt:
                        Evaluate the Answer against the Question and give marks out of maximum marks, evaluate on given evaluation difficulty
                        - Give details of what is wrong referring to the specific part of answer
                        
                        JSON format : 
                        
                                {{
                                         "marks_obtained": double value of marks obtained out of max marks,
                                         "answer_tips": ["<div>part of answer -> this part can be written with better english</div>", "string2", "string3"] // html string list of tips on how to write the answer linking to the students answer use html tags to add styling,
                                         "explanation": "<div>explanation and comparison with correct answer</div>" // html string of correct explanation to the students answer use html tags to add styling,
                                         "topic_wise_understanding": ["<div><b>sub topic</b> -> how is the understanding of the topic for this student</div>", "string2", "string3"] // html string list of topic wise understanding and analysis use html tags to add styling,
                                }}
                            
                      
                """;
    }

    private static String getPdfToQuestionWithTopicTemplate() {
        return """
                HTML raw data :  {htmlData}
                                
                Already extracted question Number = {allQuestionNumbers}
                                
                Required Topics :  {requiredTopics}
                    
                        Prompt:
                        Convert the given HTML file containing questions, only extract questions from the given topics into the following JSON format:
                        - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                        - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                        - Do not generate any questions if already generated all questions from Required Topics and set is_process_completed true.
                        - Preserve all DS_TAGs in HTML content in comments
                        
                        JSON format : 
                        
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
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "is_process_completed" : true,false // Ensure is_process_completed is set to true only if task is achieved,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        Also keep the DS_TAGS field intact in html
                        And do not try to calculate right ans, only add if available in input
                        Give the complete result to all possible questions
                """;
    }

    private static String getPdfToQuestionTemplate() {
        return """
                HTML raw data :  {htmlData}
                Already extracted question Number = {allQuestionNumbers}
                    
                        Prompt:
                        Convert the given HTML file containing questions into the following JSON format:
                         - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                         - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                         - Do not generate any questions if already generated required questions and set is_process_completed true.
                         - Preserve all DS_TAGs in HTML content in comments
                        
                        JSON format : 
                        
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
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER | NUMERIC", //Strictly Include question_type
                                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                                                 "level": "easy | medium | hard"
                                             }}
                                         ],
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "is_process_completed" : true,false // Ensure is_process_completed is set to true only if {userPrompt} is achieved,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        Also keep the DS_TAGS field intact in html
                        And do not try to calculate right ans, only add if available in input
                        
                        IMPORTANT: {userPrompt}
                """;
    }

    private static String getAudioToQuestionTemplate() {
        return """
                Class Lecture raw data :  {classLecture}
                Questions Difficulty :  {difficulty}
                Number of Questions :  {numQuestions}
                Optional Teacher Prompt :  {optionalPrompt}
                Language of questions:  {language}
                Already extracted question Number = {allQuestionNumbers}
                                
                                
                        Prompt:
                        From the given audio lecture compile hard and medium questions, try engaging questions, convert it into the following JSON format:
                          - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                         - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                         - Do not generate any questions if already generated required questions and set is_process_completed true.
                         - Preserve all DS_TAGs in HTML content in comments
                        
                        
                        JSON format : 
                        
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
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "is_process_completed": true,false // Ensure is_process_completed is set to true only if {optionalPrompt} is achieved,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                """;
    }
}
