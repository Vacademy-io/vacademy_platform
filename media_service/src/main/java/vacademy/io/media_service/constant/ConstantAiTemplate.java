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
                   - Existing Questions: {allQuestionNumbers} or none
                   - Continue for question other than {allQuestionNumbers} if needed else Start from beginning
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
        };
    }

    private static String getHtmlToQuestionTemplate() {
        return """
                **Conversion Objective**: Transform HTML question bank content into structured JSON format while preserving original markup and metadata.
                                
                        **Input Data**:
                        {htmlData}
                                
                        **Processing Instructions**:
                        1. Content Preservation:
                           - Maintain ALL DS_TAG comments in original positions
                           - Keep HTML structure intact (including <img> tags)
                           - Preserve existing numbering/naming conventions
                                
                        2. Question Handling:
                           - Detect question type from HTML structure:
                             * MCQS: Single correct multiple choice
                             * MCQM: Multiple correct choices
                             * ONE_WORD: Short answer (no options)
                             * LONG_ANSWER: Essay-type (no options)
                           - Only extract existing answer data - NEVER calculate answers
                           - Maintain original difficulty levels if specified
                                
                        3. Metadata Extraction:
                           - Extract tags from DS_TAG comments
                           - Derive subjects from question content
                           - Identify relevant class levels
                        
                          **Output JSON Format** :
                        
                                {{
                                         "questions": [
                                             {{
                                                 "question_number": "extracted_number",
                                                 "question": {{
                                                     "type": "HTML",
                                                     "content": "string <!--DS_TAG-->" // Include img tags if present
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
                        And do not try to calculate right ans, only add if available in input
                        
                        **Critical Notes**:
                                - {userPrompt}
                                - If answer data missing: leave fields empty
                                - Maintain original HTML encoding
                                - Validate JSON structure before returning
                        
                                **Validation Rules**:
                                1. Required Fields: question_number, question, question_type
                                2. Options required for MCQS/MCQM only
                                3. correct_options must match existing preview_ids
                                4. All DS_TAGs must be preserved exactly
                                5. HTML special characters must be properly escaped
                        
                 
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
                 **Feedback Generation Objective**:
                        Analyze spoken lecture content and audio metrics to create structured feedback with actionable insights.
                                
                        **Input Data**:
                        - Transcript: {text}
                        - Audio Quality Analysis: {convertedAudioResponseString}
                        - Speaking Pace: {audioPace} WPM (Optimal range: 120-150 WPM)
                                
                        **Scoring Framework**:
                        | Criteria                   | Max | Evaluation Focus                          |
                        |----------------------------|-----|------------------------------------------|
                        | Delivery & Presentation    | 20  | Vocal clarity, pacing, tone              |
                        | Content Quality            | 20  | Structure, accuracy, depth               |
                        | Student Engagement         | 15  | Interactive elements, questioning        |
                        | Assessment & Feedback      | 10  | Checks understanding, provides feedback  |
                        | Inclusivity & Language     | 10  | Accessible language, cultural sensitivity|
                        | Classroom Management       | 10  | Time management, discipline              |
                        | Teaching Aids              | 10  | Visuals, technology integration          |
                        | Professionalism            | 5   | Preparation, demeanor   \s
                              
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
                               
                                  **Validation Rules**:
                                       1. Total score = Σ criteria scores ≤100
                                       2. Scores per criteria ≤ column max
                                       3. Mandatory fields: title, totalScore, criteria[]
                                       4. Date format: ISO 8601 (DD-MM-YYYY)
                                       5. WPM analysis must influence Delivery score
                                       6. Audio quality metrics must map to Teaching Aids score
                               
                                       **Scoring Guidelines**:
                                       - Deduct 2 points/50 WPM deviation from optimal pace
                                       - Reduce Content Quality score for transcript gaps
                                       - Boost Engagement score for questions/discussions
                                       - Penalize Professionalism for excessive filler words
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
                 **PDF Conversion Protocol**
                 
                **Input Context**:
                - Source HTML: {htmlData}
                - Existing Questions: {allQuestionNumbers}
                - Special Requirement: {userPrompt}
                              
                **Processing Rules**:
                1. Continuation Logic:
                   - If no existing questions: Start from first HTML element
                   - With existing questions: Resume after last extracted question
                   - Strict duplicate prevention: Compare question stems and options
                              
                2. Content Handling:
                   - Preserve ALL DS_TAG comments verbatim
                   - Maintain original HTML structure including:
                     * Image tags (<img>)
                     * Math formulas (LaTeX/MathML)
                     * Text formatting (<b>/<i>)
                   - Never modify source ordering
                              
                3. Question Extraction:
                   - Auto-detect question types by structure:
                     ⎔ MCQS: 4 options + single correct
                     ⎔ MCQM: Multiple correct options
                     ⎔ ONE_WORD: Short answer field
                     ⎔ LONG_ANSWER: Essay-style response
                   - Only extract existing answers (NO calculations)
                         
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
                         
                         **Validation Matrix**:
                                  | Field                | Required | Condition               |
                                  |----------------------|----------|-------------------------|
                                  | question_number      | Yes      | Strict sequence         |
                                  | question.content     | Yes      | Contains DS_TAG         |
                                  | options              | MCQS and MCQM Only | 2-4 items               |
                                  | correct_options      | Try best to get | Must match preview_ids  |
                                  | question_type        | Yes      | Auto-detected           |
                                  | is_process_completed | Yes      | True when:              |
                                  |                      |          | - All questions parsed  |
                                  |                      |          | - {userPrompt} achieved |
                                 
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
                **Metadata Generation Protocol**
                       
                        **Input Data**:
                        1. Question Map format: question_id: full question text
                           {idAndQuestions}
                        2. Topic Map format: topic_id: topic_name
                           {idAndTopics}
                                
                        **Processing Rules**:
                        1. Topic Matching:
                           - Match using exact string matching between question text and topic names
                           - Include parent topics when subtopic is mentioned
                           - Maximum 5 topics per question
                           - Use ONLY provided topic IDs from input map
                                
                        2. Tag Generation:
                           - Extract 3-5 concept tags from:
                             * Key question terms
                             * Required solution strategies
                             * Curriculum frameworks
                           - Prefer camelCase for multi-word tags
                           - Avoid duplicate tags across questions
                                
                        3. Difficulty Assessment:
                           | Level    | Criteria                                  |
                           |----------|------------------------------------------|
                           | Easy     | Direct recall, <2 steps, basic formulas  |
                           | Medium   | 2-3 step reasoning, combined concepts   |
                           | Hard     | Complex analysis, >3 steps, proofs       |
                                
                        4. Problem Type Classification:
                           - knowledge_based: Fact recall, definitions, theory
                           - application_based: Problem solving, real-world use
                     
                        JSON format : 
                        
                                {{
                                         "questions": [
                                             {{
                                                 "question_id": "question_id1",
                                                 "topic_ids": ["topic_id1", "topic_id2", "topic_id3", "topic_id4", "topic_id5"], // exact topic ids that this question belongs to from the given map
                                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // these may be sub topics or the concepts of a topics, add as many as you possible
                                                 "difficulty": "easy|medium|hard", // Case-sensitive
                                                 "problem_type": "knowledge_based|application_based"
                                              }}
                                         ]
                                   }}
                                   
                                    **Validation Rules**:
                                           1. Required Fields: question_id, topic_ids, difficulty
                                           2. Topic IDs must exist in input map
                                           3. Difficulty must match complexity matrix
                                           4. Tags must be derived from question text
                                           5. No new topics/invented IDs allowed
                                   
                """;
    }
}
