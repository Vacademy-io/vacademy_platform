package vacademy.io.media_service.constant;

import vacademy.io.media_service.enums.TaskStatusTypeEnum;

public class ConstantAiTemplate {

    private static String getTextToQuestionTemplate() {

        return """
                **Objective** : Generate {numberOfQuestions} {typeOfQuestion} questions for {classLevel} students about {topics} in {language}, maintaining strict JSON format and content preservation.
                **Source Material**:
                {textPrompt}
                                
                **Instructions**:
                1. Continuation Handling:
                   - Existing Questions: {allQuestionNumbers or "None"}
                   - {f"Continue for question other than {allQuestionNumbers} if needed" else "Start from beginning"}
                   - Strictly avoid duplicate content from existing questions
                                
                2. Content Requirements:
                   - Preserve ALL DS_TAGs in HTML comments
                   - Include relevant images from source material
                   - Questions must directly relate to {topics}
                   - Maintain {classLevel} appropriate language
                                
                3. Question Type Handling:
                   - MCQS/MCQM: 4 options with clear single/multiple answers
                   - ONE_WORD/LONG_ANSWER:
                     * Omit 'options' field
                     * Provide detailed 'ans' and 'exp'
                   - Set difficulty based on cognitive complexity
                                
                4. Metadata Requirements:
                   - Tags: 5 specific tags per question
                   - Subjects: Minimum 1 relevant subject
                   - Classes: Include secondary relevant classes if applicable
                    
                **Output Format**:
                
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
                                                         "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": ["1"], // preview_id of correct option or list of correct options
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",  //Strictly Include question_type
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
                            
                       **Critical Rules**:
                                                       - If textPrompt is insufficient for {numberOfQuestions} questions, try to extract first 10 questions
                                                       - If existing questions >= {numberOfQuestions}, mark is_process_completed: true
                                                       - Never modify DS_TAG comments
                                                       - Maintain original HTML structure from source
                                                       - Strictly validate JSON syntax
                                                       - Ensure question numbers are sequential without gaps
                                                       - Never repeat question stems or options
                        
                        """;
    }

    private static String getPromptToQuestionForCourseTemplate() {

        return """
                **Objective** : {textPrompt}
                **Topic** : {title}
                                
                **Instructions**:
                1. Continuation Handling:
                   - Content Should be related to Topic
                   - Strictly avoid duplicate content from existing questions
                                
                2. Content Requirements:
                   - Preserve ALL DS_TAGs in HTML comments
                   - Include relevant images from Objective
                                
                3. Question Type Handling:
                   - MCQS/MCQM: 4 options with clear single/multiple answers
                   - ONE_WORD/LONG_ANSWER:
                     * Omit 'options' field
                     * Provide detailed 'ans' and 'exp'
                   - Set difficulty based on cognitive complexity
                                
                4. Metadata Requirements:
                   - Tags: 5 specific tags per question
                   - Subjects: Minimum 1 relevant subject
                   - Classes: Include secondary relevant classes if applicable
                    
                **Output Format**:
                
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
                                                         "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": ["1"], // preview_id of correct option or list of correct options
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",  //Strictly Include question_type
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
                            
                       **Critical Rules**:
                                                       - If textPrompt is insufficient for questions, try to extract first 5 questions
                                                       - Never modify DS_TAG comments
                                                       - Maintain original HTML structure from source
                                                       - Strictly validate JSON syntax
                                                       - Ensure question numbers are sequential without gaps
                                                       - Never repeat question stems or options
                        
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
            case EXTRACT_QUESTION_METADATA -> getMetadataOfQuestions();
            case PRESENTATION_AI_GENERATE -> getSlidesAndAssessmentPromptTemplate();
            case PRESENTATION_AI_REGENERATE_SLIDE -> getRegenerateSlidePromptTemplate();
            case PROMPT_TO_QUESTIONS -> getPromptToQuestionForCourseTemplate();
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
                                                         "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": ["1"], // preview_id of correct option or list of correct options
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",
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
                            
                        For LONG_ANSWER, and ONE_WORD question types:
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
                                
                        Prompt:
                        Extract all questions from pdf and map all the extracted questions with respective topic and strictly follow Json Format:
                         - Strictly follow this: Do not repeat same question number in two or more topics
                         - If 'Already extracted question Number' is empty, start fresh from the beginning of the HTML.
                         - If it is not empty, continue generating from where the last question left off based on the existing data and avoid duplicate Questions.
                         - Do not extract any questions if already extracted all questions and set is_process_completed true.
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
                                                    "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                    "content": "string" // Include img tags if present
                                                }}
                                            ],
                                            "correct_options": ["1"], // preview_id of correct option or list of correct options
                                            "ans": "string",
                                            "exp": "string",
                                            "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",
                                            "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // must include topic name
                                            "level": "easy | medium | hard"
                                        }}
                                    ],
                                    "title": "string", // Suitable title for the question paper
                                    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // multiple chapter and topic names for question paper
                                    "difficulty": "easy | medium | hard",
                                    "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"], // multiple subject names for question paper
                                    "classes": ["class 1", "class 2", "class 3", "class 4", "class 5", "class 6", "class 7", "class 8", "class 9", "class 10", "class 11", "class 12", "engineering", "medical", "commerce", "law"],
                                    "is_process_completed" : true,false, 
                                    "topicQuestionMap":[     //Map All {extractedQuestionNumber} question numbers to respective topic it belongs to
                                                          {{
                                                           "topic" : "String"       //Included Topic which are possible in HTML raw data
                                                           "questionNumbers": [number]  //Include all the question numbers(generated) which is related to "topic"
                                                          }}
                                                       ]
                                }}
                       
                        For LONG_ANSWER, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                       
                        Tagging Rules:
                        - Every question must include its topic in the "tags" field.
                        - Questions belonging to the same topic must have identical "tags".
                        - If a topic is not directly extractable from the question, use headings or context from the HTML.
                       
                        Also keep the DS_TAGS field intact in HTML.
                        Do not try to calculate correct answers — only include if already available in the input.
                       
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
                                                         "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": ["1"], // preview_id of correct option or list of correct options
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER ",
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
                            
                        For LONG_ANSWER, and ONE_WORD question types:
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
                                                         "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": ["1"], // preview_id of correct option or list of correct options
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER ", //Strictly Include question_type
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
                            
                        For LONG_ANSWER, and ONE_WORD question types:
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
                                                     "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                                                     "content": "string" // Include img tags if present
                                                 }},
                                                 "options": [
                                                     {{
                                                         "type": "HTML",
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": ["1"], // preview_id of correct option or list of correct options
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",
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
                            
                        For LONG_ANSWER, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                """;
    }

    private static String getMetadataOfQuestions() {
        return """
                Question Id and Question Text Data :  {idAndQuestions}
                Topic Id and Topic Name :  {idAndTopics}
                               
                        Prompt:
                         You are given a map of question id and question text and a map of topics with their ids and names.
                         Now each question needs to be analyzed and based on question text, topic id needs to get linked with questions.
                         Each Question should also be linked to the concepts that are tested from student's perspective, known ads tags
                         Data is finally to be returned in the following JSON format:
                         No need to give extra details other than json like explanation or any other data.
                         
                     
                        JSON format : 
                        
                                {{
                                         "questions": [
                                             {{
                                                 "question_id": "question_id1",
                                                 "topic_ids": ["topic_id1", "topic_id2", "topic_id3", "topic_id4", "topic_id5"], // exact topic ids that this question belongs to from the given map
                                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // these may be sub topics or the concepts of a topics, add as many as you possible
                                                 "difficulty": "string" // based on complexity and computational thinking of the question
                                                 "problem_type": "string" // if knowledge is being tested put - knowledge_based else if application is being tested put - application_based, give any one of these 2
                                             }}
                                         ]
                                   }}
                """;
    }


    /**
     * Returns the master prompt template for generating Excalidraw slides and
     * a corresponding critical thinking assessment based on input text.
     * <p>
     * The placeholder {inputText} should be replaced with the actual content.
     * Note: Literal curly braces in the JSON examples are escaped as `{{` and `}}`
     *
     * @return A multi-line string containing the full, escaped prompt.
     */
    private static String getSlidesAndAssessmentPromptTemplate() {
        return """
            **Primary Directive:**
            You are to act as an Expert AI Curriculum Developer. Your task is to process the provided input topic/text and generate a single, complete JSON object containing two key components:

            1.  A series of visually engaging, infographic-style Excalidraw slides.
            2.  A structured assessment with a set of questions designed to test deep comprehension and critical thinking.

            The entire output must be a single, valid JSON object.

            **Input Topic/Text:**

            {inputText}
                            
            **Language to be used for generating content:**

            {language}

            ---

            ### **Part 1: Generate Visual Excalidraw Slides**

            **Your Role:** Visual Information Designer

            **Your Goal:** Tell a visual story by deconstructing the input into 4-6 logical, sequential slides. Each slide must be a complete Excalidraw JSON object, designed as a professional infographic.

            **Instructions:**

            #### **Design & Layout Philosophy**
            * **One Core Idea Per Slide:** Each slide must represent a single, core idea. Arrange the slides to create a clear narrative, moving from foundational concepts to more complex analyses or implications.
            * **Create Powerful Infographics:** This is paramount. Go beyond simple boxes and text. Your goal is to create a visual metaphor that explains the slide's concept at a glance.
                * **Examples of Visual Metaphors:**
                    * Use a **funnel** to show a filtering process.
                    * Use a **hub-and-spoke diagram** for a central topic with related factors.
                    * Use a **timeline** with icons to show a sequence of events.
                    * Use **gears** to represent interconnected processes.
                    * Use a **balance scale** to compare and contrast arguments.
                    * Use a **branching tree** for causes and effects or potential outcomes.
            * **Use Icons and Simple Shapes:** Abstract concepts with simple, universally understood visuals (e.g., a lightbulb for an idea, a factory shape for industry, a shield for security).
            * **Negative Space is Key:** Do not crowd the canvas. Allow for ample white space between elements to create a clean, modern, and readable layout.

            #### **Professional Color & Typography**
            * **Cohesive Color Palette:** Choose a professional and harmonious color palette (3-4 colors max). Use color with intent.
                * **Primary Color:** For main shapes and titles.
                * **Secondary Color:** For supporting elements and body text.
                * **Accent Color:** Use sparingly for highlights, key data, or calls-to-action.
                * **Example Professional Palettes:**
                    * *Corporate Blue/Gray:* `"#0D47A1"` (Dark Blue), `"#42A5F5"` (Medium Blue), `"#F5F5F5"` (Light Gray BG), `"#424242"` (Dark Text).
                    * *Modern Teal/Earth Tones:* `"#004D40"` (Dark Teal), `"#4DB6AC"` (Medium Teal), `"#FFF3E0"` (Warm Off-white BG), `"#BF360C"` (Accent Orange).
            * **Intentional Styling:**
                * **NO STROKES:** All shapes should be filled. Set `"strokeWidth": 0` or `"strokeColor": "transparent"` for all shapes to maintain a clean, modern look. Rely on background colors (`backgroundColor`).
                * **Purposeful Fill:** Use `"fillStyle": "solid"` for most elements. Use `"hachure"` or `"cross-hatch"` only to differentiate a specific area, like a "before" vs. "after" state.
            * **Clear Typographic Hierarchy:**
                * **Titles:** Use Bold (`"fontFamily": 7`), a larger `fontSize` (e.g., 20), and your primary color.
                * **Body Text:** Use Regular (`"fontFamily": 6`), a smaller `fontSize` (e.g., 16), and a dark, legible color.
                * **Code/Annotations:** Use Code font (`"fontFamily": 8`).

            #### **Technical Layout & Dimensioning Rules (MANDATORY)**
            To ensure the generated slides are high-quality and immediately usable, you MUST follow these layout rules for every slide:
                            
            * **Index Key Integrity:** The `index` key for each element determines its stacking order.
                * It must be a unique string for every element.
                * It must be lexicographically sortable.
                * You must generate indices in a strictly increasing sequence (e.g., `a0`, `a1`, `a2`, ... `a9`, `aA`, `aB`, ...).
            * **Logical & Sequential Generation:** Process the user's request by identifying distinct objects or logical groups. Generate all elements for one group before moving to the next.
            * **Line & Font Size:** `lineHeight` should not be more than `1.5`. `fontSize` should not be more than `20` for body text.
            * **Center the Diagram on the Canvas:** Treat Top Left as `(0, 0)`. Use a balanced mix of positive x and y coordinates to center the main infographic on the canvas, preventing it from being pushed into a corner.
            * **Intelligent Text Sizing and Containment (MANDATORY TO PREVENT TRUNCATION):**
                * **Rule A: For text inside another shape:** You MUST use the `containerId` property. Set the `containerId` of the text element to the `id` of the shape it belongs to. This automatically handles centering and wrapping.
                * **Rule B: For standalone text (like a main title):** Do NOT use `containerId`. You MUST manually set a generous bounding box (`width` and `height`). Crucially, set `"autoResize": false` for all standalone text elements to force Excalidraw to respect the large bounding box you define.
            * **Define Arrow Paths with `points`:** For every element with `"type": "arrow"`, you MUST include a `points` array to define its path. Example for a horizontal arrow: `"points": [[0, 0], [width, 0]]`.

            ---

            ### **Part 2: Generate Assessment Questions**

            **Your Role:** Expert Assessment Creator

            **Your Goal:** Generate a set of high-quality questions that probe for genuine understanding, application, and analysis of the information presented in the input text.

            **Guiding Principle:** Move beyond simple fact-checking. Your goal is to create questions that assess a learner's ability to think critically *with* the material. Avoid trivial questions about metadata (e.g., "Who wrote the text?").

            #### **Cognitive Depth and Question Strategy (Based on Bloom's Taxonomy)**

            You must generate a diverse range of questions that target different cognitive levels. Ensure the assessment includes a mix of the following types, with a strong emphasis on **Analyze, Apply, and Evaluate**.

            * **1. Understand (Conceptual Questions):**
                * **Goal:** Test if the learner can explain concepts in their own words.
                * **Example:** "Which of the following statements best *summarizes* the 'greenhouse effect' as described in the text?"
            * **2. Apply (Application Questions):**
                * **Goal:** Test if the learner can use information in a new, concrete situation.
                * **Example:** "A city government is proposing a new tree-planting initiative. Based on the lecture, how would this policy *help mitigate* the urban heat island effect?" (This requires a `LONG_ANSWER` or a well-structured `MCQS`).
            * **3. Analyze (Analytical Questions):**
                * **Goal:** Test if the learner can break down information into its component parts and see the relationships between them.
                * **Example:** "What is the *most likely relationship* between the decline in arctic sea ice and the changes in global weather patterns mentioned in the text?"
            * **4. Evaluate (Evaluative Questions):**
                * **Goal:** Test if the learner can make and justify a judgment or decision.
                * **Example:** "Evaluate the claim that 'individual consumer choices are the most critical factor in combating climate change' using two pieces of evidence from the provided text." (This is ideal for a `LONG_ANSWER`).

            #### **Instructions & Schema:**

            * **Question Type Handling:**
                * For `MCQS`/`MCQM`, provide 4 distinct and plausible options. The incorrect options (distractors) should represent common misconceptions. The `correct_options` array must be accurate.
                * For `ONE_WORD`/`LONG_ANSWER`, omit the `options` field. Provide a detailed, ideal answer in the `ans` field and a thorough explanation of the underlying concepts in the `exp` field.

            * **Strict Output Format:** The questions must be contained within a JSON object matching the exact structure below.

            ```json
            {{
              "questions": [
                {{
                  "question_number": "number",
                  "question": {{ "type": "HTML", "content": "string" }},
                  "options": [
                    {{ "type": "HTML", "preview_id": "string", "content": "string" }}
                  ],
                  "correct_options": ["string"],
                  "ans": "string",
                  "exp": "string",
                  "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER"
                }}
              ]
            }}
            ```

            ---

            ### **Final Output Specification (CRITICAL)**

            Combine the outputs from Part 1 and Part 2 into a single JSON object. The root object must have exactly four keys: `slides`, `assessment`, `title`, and `slides_order`. Your success will be measured by the cognitive depth of the questions and the narrative clarity of the slides.

            **Example of Final Combined Structure (with a detailed Excalidraw slide and a higher-quality question):**

            ```json
            {{
              "slides": [
                {{
                  "type": "excalidraw",
                  "version": 2,
                  "source": "[https://excalidraw.com](https://excalidraw.com)",
                  "name": "Give a name to this slide like - How the Greenhouse Effect Works or Question About the Greenhouse Effect",
                  "elements": [
                    {{
                      "id": "A_D8s_J34Teg2BvG923a1",
                      "type": "text",
                      "x": -274.5,
                      "y": -203.859375,
                      "width": 551,
                      "height": 50,
                      "angle": 0,
                      "strokeColor": "#1e1e1e",
                      "backgroundColor": "transparent",
                      "fillStyle": "solid",
                      "strokeWidth": 2,
                      "strokeStyle": "solid",
                      "roughness": 1,
                      "opacity": 100,
                      "fontFamily": 3,
                      "fontSize": 40,
                      "textAlign": "center",
                      "verticalAlign": "middle",
                      "text": "How the Greenhouse Effect Works"
                    }},
                    {{
                      "id": "iVw5_AexnO",
                      "type": "rectangle",
                      "x": -431,
                      "y": -89.859375,
                      "width": 863,
                      "height": 339,
                      "angle": 0,
                      "strokeColor": "#868e96",
                      "backgroundColor": "#e9ecef",
                      "fillStyle": "solid",
                      "strokeWidth": 2,
                      "strokeStyle": "solid",
                      "roughness": 0,
                      "opacity": 100,
                      "roundness": {{ "type": 3 }}
                    }},
                    {{
                      "id": "n8Yrnk_pM1",
                      "type": "text",
                      "x": -403,
                      "y": -65.859375,
                      "width": 178,
                      "height": 25,
                      "angle": 0,
                      "strokeColor": "#868e96",
                      "backgroundColor": "transparent",
                      "fillStyle": "solid",
                      "strokeWidth": 2,
                      "strokeStyle": "solid",
                      "roughness": 1,
                      "opacity": 100,
                      "fontFamily": 2,
                      "fontSize": 20,
                      "textAlign": "center",
                      "verticalAlign": "middle",
                      "text": "Earth's Atmosphere"
                    }}
                  ],
                  "appState": {{ "viewBackgroundColor": "#ffffff" }}
                }}
              ],
              "assessment": {{
                "questions": [
                  {{
                    "question_number": "1",
                    "question": {{ "type": "HTML", "content": "Based on the text's description of feedback loops, which of the following is the best example of a reinforcing cycle in climate change?" }},
                    "options": [
                        {{"type":"HTML", "preview_id": "1", "content":"Increased cloud cover reflecting more sunlight back to space."}},
                        {{"type":"HTML", "preview_id": "2", "content":"Melting permafrost releasing methane, which is a potent greenhouse gas that causes more warming."}},
                        {{"type":"HTML", "preview_id": "3", "content":"Governments passing regulations to limit CO2 emissions from factories."}},
                        {{"type":"HTML", "preview_id": "4", "content":"The seasonal growth of forests absorbing atmospheric CO2."}}
                    ],
                    "correct_options": ["2"],
                    "ans": "Melting permafrost releasing methane, which is a potent greenhouse gas that causes more warming.",
                    "exp": "This is an example of a reinforcing (or positive) feedback loop because the initial effect (warming) causes a secondary effect (methane release) that further amplifies the initial effect, leading to even more warming. The other options describe balancing/negative feedback loops or external interventions.",
                    "question_type": "MCQS"
                  }}
                ],
             }},
             
             "title": "Critical Analysis of Global Warming",
             "slides_order": [Q0,S1,S2,S3,Q1,Q2,Q3,S4,Q4] // give an order of slides in the presentation
            }}
            """;
    }

    private static String getRegenerateSlidePromptTemplate() {
        return """
                **Objective**: Regenerate an Excalidraw slide based on user feedback.
                You are an expert in creating visually appealing and informative presentation slides using Excalidraw.
                You will be given the JSON representation of an existing Excalidraw slide and a text prompt with instructions for what to change.
                Modify the JSON to incorporate the feedback, ensuring the output is a valid Excalidraw data structure.
                Do not change the fundamental structure of the JSON. Only modify the elements as requested.
                For example, if the user asks to "change the title", find the element that represents the title and update its "text" property.
                If the user asks to "add a point", you should add a new text element and potentially a shape to contain it.
                    
                 * **Narrative Flow:** Each slide must represent a single, core idea. Arrange the slides to create a clear narrative, moving from foundational concepts to more complex analyses or implications.
                * **Creative Infographics:** Go beyond simple boxes. Use shapes and layouts to create meaningful visual metaphors (e.g., a branching tree for consequences, a gear system for interconnected causes, a balance scale for comparing arguments). The visuals should directly support the kind of analytical thinking required for the assessment.
                * **Engaging Styling:** Use a consistent and intentional color palette, vary typography for hierarchy (`fontFamily`, `fontSize`), and use fill styles (`"solid"`, `"cross-hatch"`, `"hachure"`) to distinguish between elements and guide the viewer's attention.
                * **Format:** The final output for this part must be a JSON array of Excalidraw objects.
                                
                Make the Excalidraw objects as compact, modern and professional looking as possible 
                Avoid stokes for objects, it looks unprofessional, just give background color
                Layout and Dimensioning Rules 
                To ensure the generated slides are high-quality and immediately usable, you MUST follow these layout rules for every slide:
                                
                lineHeight should not be more than 1.5
                fontSize should not be more than 20         
                Center the Diagram on the Canvas:
                                
                Use default  "fontFamily": 6,
                For code typo - "fontFamily": 8,
                For Bold - "fontFamily": 7,    
                                
                Treat Top Left as (0, 0).
                To achieve this, use a balanced mix of x and y coordinates. For example, a diagram 800px wide should span from roughly x: 0 to x: 800. A diagram 600px tall should span from y: 0 to y: 600. This prevents the diagram from being pushed into a corner.
                Prevent Text Cut-Off:
                                
                For every text element, you must set the width and height properties to be significantly larger than the text content it holds. This creates a generous bounding box and prevents the text from being truncated.
                Rule of Thumb: For a single-line title, use a width of 500-800px. For a multi-line paragraph, use a width of 400-600px and a height that can accommodate all lines comfortably (e.g., 100-200px). It is better for the bounding box to be too big than too small.
                                
                Intelligent Text Sizing and Containment (MANDATORY TO PREVENT TRUNCATION):
                                
                Rule A: For text that should be inside another shape (like a label in a box):
                You MUST use the containerId property. Set the containerId of the text element to the id of the shape it belongs to.
                When using containerId, Excalidraw automatically centers and wraps the text. You do not need to manually calculate a large bounding box for the text.
                Rule B: For standalone text (like a main title):
                Do NOT use containerId.
                You MUST manually set a generous bounding box. A good rule is to make the width significantly larger than the text itself appears to need.
                Crucially, set "autoResize": false for all standalone text elements. This forces Excalidraw to respect the large width and height you define, preventing the text from being cut off on initial load.
                Give enough space for the text to be contained within the bounding box.
                If text is too large, it will be cut off, better if it is in small font size and in multiple lines
                                
                Define Arrow Paths with points
                                
                For every element with "type": "arrow", you MUST include a points array to define its path. This is a mandatory attribute required to prevent rendering errors.
                The points are relative to the arrow's x and y coordinates.
                Example for a horizontal arrow: "points": [[0, 0], [width, 0]]
                Example for a vertical arrow: "points": [[0, 0], [0, height]]
                                
                index Key Integrity:  The index key for each element determines its stacking order.
                                
                It must be a unique string for every element.
                It must be lexicographically sortable.
                You must generate indices in a strictly increasing sequence (e.g., a0, a1, a2, ... a9, aA, aB, ...). Do not generate an index like b0 after b5.
                Logical & Sequential Generation: Process the user's request by identifying distinct objects or logical groups. Generate all elements for one group (e.g., a flowchart shape and its text label, or a character and their speech bubble) before moving to the next group. This ensures related elements have sequential and correct index keys.
                ---
                                
                **Excalidraw JSON**:
                {initialData}
                    
                **User Prompt**:
                {text}
                    
                **Output**:
                Return only the modified Excalidraw JSON. Do not include any other text or explanation.
                The JSON should be a single object, starting with `{{` and ending with `}}`.

                {{
                      "type": "excalidraw",
                      "version": 2,
                      "source": "[https://excalidraw.com](https://excalidraw.com)",
                      "elements": [
                        {{
                          "id": "A_D8s_J34Teg2BvG923a1",
                          "type": "text",
                          "x": -274.5,
                          "y": -203.859375,
                          "width": 551,
                          "height": 50,
                          "angle": 0,
                          "strokeColor": "#1e1e1e",
                          "backgroundColor": "transparent",
                          "fillStyle": "solid",
                          "strokeWidth": 2,
                          "strokeStyle": "solid",
                          "roughness": 1,
                          "opacity": 100,
                          "fontFamily": 3,
                          "fontSize": 40,
                          "textAlign": "center",
                          "verticalAlign": "middle",
                          "text": "How the Greenhouse Effect Works"
                        }},
                        {{
                          "id": "iVw5_AexnO",
                          "type": "rectangle",
                          "x": -431,
                          "y": -89.859375,
                          "width": 863,
                          "height": 339,
                          "angle": 0,
                          "strokeColor": "#868e96",
                          "backgroundColor": "#e9ecef",
                          "fillStyle": "solid",
                          "strokeWidth": 2,
                          "strokeStyle": "solid",
                          "roughness": 0,
                          "opacity": 100,
                          "roundness": {{ "type": 3 }}
                        }},
                        {{
                          "id": "n8Yrnk_pM1",
                          "type": "text",
                          "x": -403,
                          "y": -65.859375,
                          "width": 178,
                          "height": 25,
                          "angle": 0,
                          "strokeColor": "#868e96",
                          "backgroundColor": "transparent",
                          "fillStyle": "solid",
                          "strokeWidth": 2,
                          "strokeStyle": "solid",
                          "roughness": 1,
                          "opacity": 100,
                          "fontFamily": 2,
                          "fontSize": 20,
                          "textAlign": "center",
                          "verticalAlign": "middle",
                          "text": "Earth's Atmosphere"
                        }}
                      ],
                      "appState": {{ "viewBackgroundColor": "#ffffff" }}
                    }}
                """;

                
    }

}
