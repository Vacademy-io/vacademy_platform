# Chat Agent - Quiz/Practice Mode Integration Guide

This document explains the frontend updates needed to support the new **message categorization** and **practice mode** features in the AI chat agent.

## Overview

Messages can now be categorized into three intents:

- **DOUBT**: User has a question - AI provides detailed explanations
- **PRACTICE**: User wants to practice - AI generates a quiz
- **GENERAL**: Regular conversation (default)

## Message Types

The SSE stream can now send these message types:

| Type            | Description                                 |
| --------------- | ------------------------------------------- |
| `user`          | User's message                              |
| `assistant`     | AI's text response                          |
| `tool_call`     | Internal tool call (can be hidden)          |
| `tool_result`   | Internal tool result (can be hidden)        |
| `quiz`          | **NEW**: Contains quiz data for rendering   |
| `quiz_feedback` | **NEW**: Contains quiz results and feedback |

## API Changes

### Send Message Request

```typescript
interface SendMessageRequest {
  message: string;
  intent?: "doubt" | "practice" | "general"; // Optional, auto-classified if not provided
  quiz_submission?: {
    quiz_id: string;
    answers: Record<string, number>; // question_id -> selected_option_index
    time_taken_seconds?: number;
  };
}
```

### Example: Request a Quiz

```javascript
await sendMessage({
  message: "I want to practice",
  intent: "practice", // Optional - AI will detect "practice" keywords
});
```

### Example: Submit Quiz Answers

```javascript
await sendMessage({
  message: "Quiz completed",
  quiz_submission: {
    quiz_id: "quiz-uuid-123",
    answers: {
      q1: 0, // Selected option index for question 1
      q2: 2, // Selected option index for question 2
      q3: 1, // etc.
    },
    time_taken_seconds: 180,
  },
});
```

## Quiz Message Structure

When AI sends a quiz, the SSE event looks like:

````javascript
{
  "event": "message",
  "data": {
    "id": 123,
    "type": "quiz",  // <-- Check for this type
    "content": "Here's your quiz on **Photosynthesis**! Answer all 5 questions.",
    "metadata": {
      "quiz_data": {
        "quiz_id": "uuid-123",
        "title": "Quiz on Photosynthesis",
        "topic": "Photosynthesis",
        "total_questions": 5,
        "time_limit_seconds": 300,
        "questions": [
          {
            "id": "q1",
            "question": "What is the **primary pigment** in photosynthesis?\n\n```\nHint: It gives plants their green color\n```",
            "options": [
              "`Chlorophyll`",
              "`Carotenoid`",
              "`Xanthophyll`",
              "`Phycocyanin`"
            ]
            // NOTE: correct_answer_index is NOT included (to prevent cheating)
          },
          // ... more questions
        ]
      }
    },
    "created_at": "2026-01-15T21:00:00Z"
  }
}
````

## Quiz Feedback Message Structure

After quiz submission:

```javascript
{
  "event": "message",
  "data": {
    "id": 124,
    "type": "quiz_feedback",  // <-- Check for this type
    "content": "## Quiz Results 🎉\n\n**Score:** 4/5 (80%)\n\n**Status:** ✅ Passed!\n\nGreat work!...",
    "metadata": {
      "feedback": {
        "quiz_id": "uuid-123",
        "score": 4,
        "total": 5,
        "percentage": 80.0,
        "passed": true,
        "overall_feedback": "Great job! You have a strong understanding...",
        "recommendations": [
          "Review the light-dependent reactions",
          "Practice more questions on ATP synthesis"
        ],
        "time_taken_seconds": 180,
        "question_feedback": [
          {
            "question_id": "q1",
            "question_text": "What is the primary pigment?",
            "correct": true,
            "user_answer_index": 0,
            "correct_answer_index": 0,
            "user_answer_text": "Chlorophyll",
            "correct_answer_text": "Chlorophyll",
            "explanation": "Chlorophyll is the main photosynthetic pigment..."
          },
          // ... feedback for each question
        ]
      }
    },
    "created_at": "2026-01-15T21:02:00Z"
  }
}
```

## Frontend Component Updates

### 1. Message Type Detection

```typescript
function renderMessage(message: ChatMessage) {
  switch (message.type) {
    case "quiz":
      return (
        <QuizComponent
          quizData={message.metadata.quiz_data}
          onSubmit={handleQuizSubmit}
        />
      );

    case "quiz_feedback":
      return (
        <QuizFeedbackComponent
          feedback={message.metadata.feedback}
          content={message.content} // Markdown summary
        />
      );

    case "assistant":
    case "user":
    default:
      return <ChatBubble message={message} />;
  }
}
```

### 2. Quiz Component

```typescript
interface QuizComponentProps {
  quizData: {
    quiz_id: string;
    title: string;
    topic: string;
    total_questions: number;
    time_limit_seconds?: number;
    questions: Array<{
      id: string;
      question: string; // Markdown format
      options: string[]; // Markdown format
    }>;
  };
  onSubmit: (answers: Record<string, number>) => void;
}

function QuizComponent({ quizData, onSubmit }: QuizComponentProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startTime] = useState(Date.now());

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = () => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    onSubmit({
      quiz_id: quizData.quiz_id,
      answers,
      time_taken_seconds: timeTaken,
    });
  };

  return (
    <div className="quiz-container">
      <h2>{quizData.title}</h2>

      {quizData.questions.map((q, idx) => (
        <div key={q.id} className="question">
          <h3>Question {idx + 1}</h3>
          {/* Render question as Markdown */}
          <ReactMarkdown>{q.question}</ReactMarkdown>

          <div className="options">
            {q.options.map((option, optIdx) => (
              <label
                key={optIdx}
                className={answers[q.id] === optIdx ? "selected" : ""}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === optIdx}
                  onChange={() => handleOptionSelect(q.id, optIdx)}
                />
                {/* Render option as Markdown */}
                <ReactMarkdown>{option}</ReactMarkdown>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={Object.keys(answers).length < quizData.total_questions}
      >
        Submit Quiz
      </button>
    </div>
  );
}
```

### 3. Quiz Feedback Component

```typescript
interface QuizFeedbackProps {
  feedback: {
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
    overall_feedback: string;
    recommendations: string[];
    question_feedback: Array<{
      question_id: string;
      question_text: string;
      correct: boolean;
      user_answer_text?: string;
      correct_answer_text: string;
      explanation?: string;
    }>;
  };
  content: string; // Pre-formatted markdown summary
}

function QuizFeedbackComponent({ feedback, content }: QuizFeedbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="quiz-feedback">
      {/* Main summary as Markdown */}
      <ReactMarkdown>{content}</ReactMarkdown>

      {/* Toggle for detailed results */}
      <button onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? "Hide" : "Show"} Question Details
      </button>

      {showDetails && (
        <div className="question-details">
          {feedback.question_feedback.map((qf, idx) => (
            <div
              key={qf.question_id}
              className={qf.correct ? "correct" : "incorrect"}
            >
              <h4>
                Question {idx + 1}: {qf.correct ? "✅" : "❌"}
              </h4>
              <ReactMarkdown>{qf.question_text}</ReactMarkdown>

              <p>
                <strong>Your answer:</strong>{" "}
                {qf.user_answer_text || "Not answered"}
              </p>
              {!qf.correct && (
                <p>
                  <strong>Correct answer:</strong> {qf.correct_answer_text}
                </p>
              )}
              {qf.explanation && (
                <div className="explanation">
                  <strong>Explanation:</strong>
                  <ReactMarkdown>{qf.explanation}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## AI Status Updates

New status during quiz generation:

```javascript
{
  "event": "status",
  "data": {
    "ai_status": "generating_quiz"  // NEW status
  }
}
```

Update your status indicator to show appropriate loading states:

```typescript
function getStatusText(status: string) {
  switch (status) {
    case "thinking":
      return "AI is thinking...";
    case "generating_quiz":
      return "Generating quiz..."; // NEW
    case "tool_executing":
      return "Looking something up...";
    case "idle":
      return "";
  }
}
```

## Markdown Rendering

Questions and options are in **Markdown format** to support:

- Code blocks (`python ... `)
- Bold/italic text
- LaTeX math ($x^2$)
- Lists and tables

Recommended library: `react-markdown` with syntax highlighting

```bash
npm install react-markdown react-syntax-highlighter
```

```typescript
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";

<ReactMarkdown
  components={{
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <SyntaxHighlighter language={match[1]} {...props}>
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  }}
>
  {question}
</ReactMarkdown>;
```

## CSS Suggestions

```css
.quiz-container {
  background: var(--surface);
  border-radius: 12px;
  padding: 20px;
  margin: 10px 0;
}

.question {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.options label {
  display: block;
  padding: 12px 16px;
  margin: 8px 0;
  border: 2px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.options label:hover {
  border-color: var(--primary);
  background: var(--primary-light);
}

.options label.selected {
  border-color: var(--primary);
  background: var(--primary-light);
}

.quiz-feedback .correct {
  border-left: 4px solid var(--success);
  padding-left: 16px;
}

.quiz-feedback .incorrect {
  border-left: 4px solid var(--error);
  padding-left: 16px;
}
```

## Summary

1. **Check message type** - Render `quiz` and `quiz_feedback` types differently
2. **Use Markdown renderer** - Questions and options support rich formatting
3. **Track quiz state** - Store selected answers and timing
4. **Submit correctly** - Include `quiz_submission` in the message request
5. **Handle new status** - Show appropriate loading state for `generating_quiz`
