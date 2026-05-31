"""Question-metadata prompt — ported verbatim from media_service
ConstantAiTemplate.getMetadataOfQuestions(). Placeholders {idAndQuestions},
{idAndTopics}; literal JSON braces doubled for str.format.
"""
from __future__ import annotations

_TEMPLATE = """Question Id and Question Text Data :  {idAndQuestions}
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
"""


def build_prompt(id_and_questions: str, id_and_topics: str) -> str:
    return _TEMPLATE.format(idAndQuestions=id_and_questions, idAndTopics=id_and_topics)
