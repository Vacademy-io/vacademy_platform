// src/components/QuizInteraction.tsx
import React, { useState, useEffect } from 'react';
import { type AddedQuestion } from '@/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox'; // For multiple choice if needed
import { toast } from 'sonner';
import { Loader2, Send, Hourglass } from 'lucide-react';
import { Input } from '@/components/ui/input'; // Added Input
import { Textarea } from '@/components/ui/textarea'; // Added Textarea

// Define BASE_URL - move to a config file or env variable later
const BASE_URL = 'https://backend-stage.vacademy.io';

interface QuizInteractionProps {
  questionData: AddedQuestion;
  sessionId: string;
  slideId: string;
  username: string;
  studentAttemptsAllowed: number; // From sessionData.student_attempts
}

export const QuizInteraction: React.FC<QuizInteractionProps> = ({
  questionData,
  sessionId,
  slideId,
  username,
  studentAttemptsAllowed
}) => {
  // Log the crucial parts of questionData as QuizInteraction sees them
  console.log('[QuizInteraction] Received questionData.id:', questionData.id);
  console.log('[QuizInteraction] Received questionData.text.content:', questionData.text?.content);
  console.log('[QuizInteraction] Received questionData.options:', JSON.parse(JSON.stringify(questionData.options)));

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState(''); // Added state for text answers
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now()); // Added state for response time tracking
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionCategory = (type: string | undefined) => {
    if (!type) return 'unknown';
    const upperType = type.toUpperCase();
    if (upperType === 'MCQS' || upperType === 'MCQM') return 'multiple_choice';
    if (upperType === 'ONE_WORD' || upperType === 'LONG_ANSWER' || upperType === 'NUMERICAL') return 'text_input';
    return 'unknown';
  };

  const currentQuestionCategory = questionCategory(questionData.question_type);
  const isMultipleChoice = questionData.question_type?.toUpperCase() === 'MCQM';
  const canAttempt = submissionCount < studentAttemptsAllowed;

  useEffect(() => {
    // Reset selection and answer when question changes
    setSelectedOptionIds([]);
    setTextAnswer(''); // Reset text answer
    setResponseStartTime(Date.now()); // Reset start time
    setSubmissionCount(0); // Or fetch from backend if attempts are persisted per user per question
    setError(null);
  }, [questionData.id]);

  const handleOptionChange = (optionId: string) => {
    if (!canAttempt) return;
    setSelectedOptionIds(prev => {
      if (isMultipleChoice) {
        return prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId];
      } else {
        return [optionId]; // Single choice
      }
    });
  };

  const handleSubmit = async () => {
    const timeToResponseMillis = Date.now() - responseStartTime;

    if (currentQuestionCategory === 'multiple_choice' && selectedOptionIds.length === 0) {
      setError("Please select an option.");
      return;
    } else if (currentQuestionCategory === 'text_input' && textAnswer.trim() === '') {
      setError("Please enter your answer.");
      return;
    } else if (currentQuestionCategory === 'unknown') {
      setError("Cannot submit for unknown or invalid question type.");
      return;
    }

    if (!canAttempt) {
        setError("No more attempts allowed for this question.");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    // If currentQuestionCategory is not 'unknown', questionData.question_type is guaranteed to be a known type string.
    const responseTypeStr = questionData.question_type!.toUpperCase();

    const payload = {
        username: username,
        time_to_response_millis: timeToResponseMillis,
        response_type: responseTypeStr,
        selected_option_ids: (currentQuestionCategory === 'multiple_choice') ? selectedOptionIds : null,
        text_answer: (currentQuestionCategory === 'text_input') ? textAnswer.trim() : null,
    };

    const apiUrl = `${BASE_URL}/community-service/engage/learner/${sessionId}/slide/${slideId}/respond`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSubmissionCount(prev => prev + 1);
        toast.success("Answer Submitted Successfully!", {
          description: `Attempt ${submissionCount + 1} of ${studentAttemptsAllowed}.`,
        });
        setResponseStartTime(Date.now()); // Reset for next potential interaction/resubmission if allowed
        if (submissionCount + 1 >= studentAttemptsAllowed) {
          toast.info("No more attempts", {
              description: "You have used all your attempts for this question.",
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: "Submission failed with status: " + response.status }));
        setError(errorData.message || "Failed to submit answer. Please try again.");
        toast.error("Submission Failed", {
          description: errorData.message || "Could not submit your answer.",
        });
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
      toast.error("Submission Error", {
        description: e.message || "An unexpected network error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper to safely render HTML content
  const createMarkup = (htmlContent: string) => {
    return { __html: htmlContent };
  };

  if (!canAttempt) {
    return (
      <Card className="w-full max-w-2xl mx-auto shadow-lg my-4 animate-pulse">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-semibold text-slate-800">
             <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question Submitted")} />
          </CardTitle>
          <CardDescription>You have used all your attempts.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
            <Hourglass className="mx-auto size-12 text-primary mb-4" />
            <p className="text-lg font-medium text-slate-600">
                Waiting for the presenter to move to the next slide...
            </p>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-slate-500 text-right w-full">
                Attempts: {submissionCount} / {studentAttemptsAllowed}
            </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg my-4">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl font-semibold text-slate-800">
          <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question")} />
        </CardTitle>
        {questionData.question_type && <p className="text-sm text-slate-500">Type: {questionData.question_type}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {currentQuestionCategory === 'multiple_choice' ? (
          questionData.options.length > 0 ? (
            <RadioGroup
              onValueChange={(value: string) => handleOptionChange(value)}
              value={isMultipleChoice ? undefined : selectedOptionIds[0]}
              disabled={!canAttempt || isSubmitting}
              className="space-y-2"
            >
              {questionData.options.map((option) => (
                <div
                  key={option.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-all
                              ${selectedOptionIds.includes(option.id) ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}
                              ${(!canAttempt || isSubmitting) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => !isMultipleChoice && canAttempt && !isSubmitting && handleOptionChange(option.id)}
                >
                  {isMultipleChoice ? (
                    <Checkbox
                      id={`option-${option.id}`}
                      checked={selectedOptionIds.includes(option.id)}
                      onCheckedChange={() => handleOptionChange(option.id)}
                      disabled={!canAttempt || isSubmitting}
                      className="size-5"
                    />
                  ) : (
                    <RadioGroupItem
                      value={option.id}
                      id={`option-${option.id}`}
                      className="size-5 border-slate-400 data-[state=checked]:border-primary data-[state=checked]:text-primary focus:ring-primary"
                    />
                  )}
                  <Label htmlFor={`option-${option.id}`} className={`flex-1 text-sm sm:text-base font-medium ${(!canAttempt || isSubmitting) ? 'text-slate-500' : 'text-slate-700'} cursor-pointer`}
                    dangerouslySetInnerHTML={createMarkup(option.text.content || `Option ${option.option_order || ''}`)}
                  />
                </div>
              ))}
            </RadioGroup>
          ) : (
              <p className="text-slate-500 text-center py-4">No options available for this question.</p>
          )
        ) : currentQuestionCategory === 'text_input' ? (
          questionData.question_type === 'ONE_WORD' || questionData.question_type === 'NUMERICAL' ? (
            <Input 
              type={questionData.question_type === 'NUMERICAL' ? 'number' : 'text'}
              placeholder={`Your ${questionData.question_type === 'NUMERICAL' ? 'numerical' : 'one word'} answer`}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={!canAttempt || isSubmitting}
              className="mt-2"
            />
          ) : questionData.question_type === 'LONG_ANSWER' ? (
            <Textarea 
              placeholder="Your detailed answer..."
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={!canAttempt || isSubmitting}
              className="mt-2 min-h-[100px]"
              rows={4}
            />
          ) : null // Should not reach here if currentQuestionCategory is 'text_input' and type is unknown
        ) : (
          <p className="text-slate-500 text-center py-4">Unsupported question type: {questionData.question_type}</p>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
         <p className="text-xs text-slate-500 text-right">
            Attempts: {submissionCount} / {studentAttemptsAllowed}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={!canAttempt || isSubmitting || 
            (currentQuestionCategory === 'multiple_choice' ? selectedOptionIds.length === 0 : false) ||
            (currentQuestionCategory === 'text_input' ? !textAnswer.trim() : false) ||
            (currentQuestionCategory === 'unknown')
          }
          className="w-full sm:w-auto sm:ml-auto"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          Submit Answer
        </Button>
      </CardFooter>
    </Card>
  );
};