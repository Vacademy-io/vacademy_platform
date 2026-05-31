"""Lecture-feedback prompt — ported verbatim from media_service
ConstantAiTemplate.getLectureFeedbackTemplate(). Placeholders {text},
{convertedAudioResponseString}, {audioPace}; literal JSON braces doubled.
"""
from __future__ import annotations

_TEMPLATE = """Spoken Text : {text}
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
"""


def build_prompt(text: str, converted_audio_response_string: str, audio_pace: str) -> str:
    return _TEMPLATE.format(
        text=text,
        convertedAudioResponseString=converted_audio_response_string,
        audioPace=audio_pace,
    )
