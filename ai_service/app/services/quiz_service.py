"""
Quiz Service - Handles quiz generation and evaluation for practice mode.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Dict, Any, List, Optional
from uuid import uuid4

from ..schemas.chat_agent import (
    QuizData,
    QuizQuestion,
    QuizSubmission,
    QuizFeedback,
    QuestionFeedback,
)
from ..services.chat_llm_client import ChatLLMClient

logger = logging.getLogger(__name__)


class QuizService:
    """
    Handles quiz generation and evaluation for practice mode.
    Uses LLM to generate contextually relevant questions and provide feedback.
    """
    
    def __init__(self, llm_client: ChatLLMClient):
        self.llm_client = llm_client
    
    async def generate_quiz(
        self,
        topic: str,
        context: Dict[str, Any],
        num_questions: int = 5,
        difficulty: str = "medium",
        institute_id: str = None,
        user_id: str = None,
    ) -> QuizData:
        """
        Generate quiz questions based on the topic and context.
        
        Args:
            topic: The topic to generate questions about
            context: Context information including slide/course content
            num_questions: Number of questions to generate (default 5)
            difficulty: Question difficulty (easy/medium/hard)
            institute_id: Institute ID for LLM tracking
            user_id: User ID for LLM tracking
            
        Returns:
            QuizData object with generated questions
        """
        # Extract relevant content from context
        context_data = context.get("context_data", {})
        content_text = context_data.get("content", "")
        slide_name = context_data.get("name", topic)
        chapter = context_data.get("chapter", "")
        subject = context_data.get("subject", "")
        
        # Build the quiz generation prompt
        prompt = f"""Generate exactly {num_questions} multiple choice questions for a quiz on the topic: "{topic}"

CONTEXT INFORMATION:
- Subject: {subject}
- Chapter: {chapter}
- Current Content: {slide_name}
- Content Details: {content_text[:2000] if content_text else 'General topic'}

DIFFICULTY LEVEL: {difficulty}

REQUIREMENTS:
1. Each question should have exactly 4 options (A, B, C, D)
2. Only one option should be correct
3. Questions should test understanding, not just memorization
4. Include a brief explanation for why the correct answer is correct
5. Make questions progressively harder if difficulty is "hard"

IMPORTANT - MARKDOWN FORMATTING:
- Questions and options MUST be in markdown format
- Use code blocks (```language) for code snippets
- Use **bold** and *italic* for emphasis
- Use LaTeX for math: $x^2$ or $$\\frac{{a}}{{b}}$$
- This allows rich content like code questions, formulas, etc.

Example question with code:
{{
    "question": "What will be the output of this Python code?\\n\\n```python\\nprint([x**2 for x in range(3)])\\n```",
    "options": ["`[0, 1, 4]`", "`[1, 4, 9]`", "`[0, 1, 2]`", "`[1, 2, 3]`"]
}}

Return your response as JSON in this exact format:
{{
    "title": "Quiz on [Topic]",
    "questions": [
        {{
            "id": "q1",
            "question": "Question text in **markdown** format?",
            "options": ["Option A (markdown)", "Option B (markdown)", "Option C (markdown)", "Option D (markdown)"],
            "correct_answer_index": 0,
            "explanation": "Brief explanation in markdown"
        }},
        ...more questions...
    ]
}}

IMPORTANT: Return ONLY valid JSON, no additional text or markdown code blocks around the JSON."""

        try:
            # Call LLM
            response = await self.llm_client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are an expert quiz generator. Generate educational multiple choice questions based on the given context. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                tools=None,
                temperature=0.7,
                institute_id=institute_id,
                user_id=user_id,
            )
            
            content = response.get("content", "")
            
            # Parse JSON from response (handle markdown code blocks)
            json_content = self._extract_json(content)
            quiz_json = json.loads(json_content)
            
            # Build quiz data
            questions = []
            for q in quiz_json.get("questions", []):
                questions.append(QuizQuestion(
                    id=q.get("id", f"q{len(questions)+1}"),
                    question=q.get("question", ""),
                    options=q.get("options", []),
                    correct_answer_index=q.get("correct_answer_index", 0),
                    explanation=q.get("explanation", ""),
                ))
            
            return QuizData(
                quiz_id=str(uuid4()),
                title=quiz_json.get("title", f"Quiz on {topic}"),
                topic=topic,
                questions=questions,
                total_questions=len(questions),
                time_limit_seconds=num_questions * 60,  # 1 minute per question
            )
            
        except Exception as e:
            logger.error(f"Failed to generate quiz: {e}")
            # Return a fallback quiz with basic questions
            return self._generate_fallback_quiz(topic, num_questions)
    
    def _extract_json(self, content: str) -> str:
        """Extract JSON from LLM response, handling markdown code blocks."""
        # Try to find JSON in code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if json_match:
            return json_match.group(1).strip()
        
        # Try to find raw JSON
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            return json_match.group(0)
        
        return content
    
    def _generate_fallback_quiz(self, topic: str, num_questions: int) -> QuizData:
        """Generate a basic fallback quiz if LLM generation fails."""
        questions = []
        for i in range(min(num_questions, 3)):
            questions.append(QuizQuestion(
                id=f"q{i+1}",
                question=f"Sample question {i+1} about {topic}?",
                options=["Option A", "Option B", "Option C", "Option D"],
                correct_answer_index=0,
                explanation="This is a fallback question.",
            ))
        
        return QuizData(
            quiz_id=str(uuid4()),
            title=f"Practice Quiz on {topic}",
            topic=topic,
            questions=questions,
            total_questions=len(questions),
        )
    
    def get_quiz_for_frontend(self, quiz_data: QuizData) -> Dict[str, Any]:
        """
        Prepare quiz data for frontend - strips correct answers.
        
        The frontend should not receive the correct answers to prevent cheating.
        """
        return {
            "quiz_id": quiz_data.quiz_id,
            "title": quiz_data.title,
            "topic": quiz_data.topic,
            "total_questions": quiz_data.total_questions,
            "time_limit_seconds": quiz_data.time_limit_seconds,
            "questions": [
                {
                    "id": q.id,
                    "question": q.question,
                    "options": q.options,
                    # Note: correct_answer_index and explanation are NOT included
                }
                for q in quiz_data.questions
            ]
        }
    
    async def evaluate_quiz(
        self,
        quiz_data: QuizData,
        submission: QuizSubmission,
        context: Dict[str, Any],
        institute_id: str = None,
        user_id: str = None,
    ) -> QuizFeedback:
        """
        Evaluate quiz submission and generate feedback.
        
        Args:
            quiz_data: The original quiz with correct answers
            submission: User's submitted answers
            context: Context for generating personalized feedback
            
        Returns:
            QuizFeedback with scores and recommendations
        """
        # Calculate scores
        correct_count = 0
        question_feedback_list: List[QuestionFeedback] = []
        
        for question in quiz_data.questions:
            user_answer = submission.answers.get(question.id)
            is_correct = user_answer == question.correct_answer_index
            
            if is_correct:
                correct_count += 1
            
            # Get answer texts
            user_answer_text = None
            if user_answer is not None and 0 <= user_answer < len(question.options):
                user_answer_text = question.options[user_answer]
            
            correct_answer_text = question.options[question.correct_answer_index]
            
            question_feedback_list.append(QuestionFeedback(
                question_id=question.id,
                question_text=question.question,
                correct=is_correct,
                user_answer_index=user_answer,
                correct_answer_index=question.correct_answer_index,
                user_answer_text=user_answer_text,
                correct_answer_text=correct_answer_text,
                explanation=question.explanation,
            ))
        
        total = len(quiz_data.questions)
        percentage = (correct_count / total * 100) if total > 0 else 0
        passed = percentage >= 60
        
        # Generate AI feedback
        overall_feedback, recommendations = await self._generate_ai_feedback(
            quiz_data=quiz_data,
            question_feedback=question_feedback_list,
            score=correct_count,
            total=total,
            percentage=percentage,
            context=context,
            institute_id=institute_id,
            user_id=user_id,
        )
        
        return QuizFeedback(
            quiz_id=quiz_data.quiz_id,
            score=correct_count,
            total=total,
            percentage=round(percentage, 1),
            passed=passed,
            question_feedback=question_feedback_list,
            overall_feedback=overall_feedback,
            recommendations=recommendations,
            time_taken_seconds=submission.time_taken_seconds,
        )
    
    async def _generate_ai_feedback(
        self,
        quiz_data: QuizData,
        question_feedback: List[QuestionFeedback],
        score: int,
        total: int,
        percentage: float,
        context: Dict[str, Any],
        institute_id: str = None,
        user_id: str = None,
    ) -> tuple[str, List[str]]:
        """Generate personalized AI feedback based on quiz performance."""
        
        # Analyze wrong answers
        wrong_questions = [qf for qf in question_feedback if not qf.correct]
        
        prompt = f"""A student just completed a quiz on "{quiz_data.topic}".

RESULTS:
- Score: {score}/{total} ({percentage:.1f}%)
- Status: {"PASSED ✅" if percentage >= 60 else "NEEDS IMPROVEMENT ⚠️"}

WRONG ANSWERS:
{self._format_wrong_answers(wrong_questions) if wrong_questions else "None! Perfect score! 🎉"}

Please provide:
1. A brief, encouraging overall feedback (2-3 sentences). Use emojis sparingly.
2. 2-3 specific, actionable recommendations for improvement (or praise if perfect score).

Return as JSON:
{{
    "overall_feedback": "Your feedback here...",
    "recommendations": ["Recommendation 1", "Recommendation 2"]
}}"""

        try:
            response = await self.llm_client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are an encouraging educational tutor providing quiz feedback. Be supportive and constructive."},
                    {"role": "user", "content": prompt}
                ],
                tools=None,
                temperature=0.7,
                institute_id=institute_id,
                user_id=user_id,
            )
            
            content = response.get("content", "")
            json_content = self._extract_json(content)
            feedback_json = json.loads(json_content)
            
            return (
                feedback_json.get("overall_feedback", self._get_default_feedback(percentage)),
                feedback_json.get("recommendations", [])
            )
            
        except Exception as e:
            logger.error(f"Failed to generate AI feedback: {e}")
            return (self._get_default_feedback(percentage), [])
    
    def _format_wrong_answers(self, wrong_questions: List[QuestionFeedback]) -> str:
        """Format wrong answers for the feedback prompt."""
        lines = []
        for qf in wrong_questions:
            lines.append(f"- Q: {qf.question_text}")
            lines.append(f"  User answered: {qf.user_answer_text or 'Not answered'}")
            lines.append(f"  Correct answer: {qf.correct_answer_text}")
        return "\n".join(lines)
    
    def _get_default_feedback(self, percentage: float) -> str:
        """Get default feedback based on score percentage."""
        if percentage >= 90:
            return "Excellent work! 🌟 You've demonstrated a strong understanding of this topic."
        elif percentage >= 70:
            return "Good job! 👍 You have a solid grasp of the concepts. Keep practicing to master them fully."
        elif percentage >= 60:
            return "Nice effort! You passed the quiz. Review the questions you missed to strengthen your understanding."
        else:
            return "Keep practicing! 💪 Review the material and try again. Every attempt helps you learn."


__all__ = ["QuizService"]
