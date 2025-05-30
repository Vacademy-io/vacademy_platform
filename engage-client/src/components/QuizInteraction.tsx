// src/components/QuizInteraction.tsx
import React, { useState, useEffect } from 'react';
import { type AddedQuestion } from '@/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox'; // For multiple choice if needed
import { submitQuizAnswer, type SubmitAnswerPayload } from '@/services/engageApi';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

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
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMultipleChoice = questionData.question_type?.toUpperCase() === 'MCQM'; // Or similar logic based on your types
  const canAttempt = submissionCount < studentAttemptsAllowed;

  useEffect(() => {
    // Reset selection when question changes
    setSelectedOptionIds([]);
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
    if (selectedOptionIds.length === 0) {
      setError("Please select an option.");
      return;
    }
    if (!canAttempt) {
        setError("No more attempts allowed for this question.");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: SubmitAnswerPayload = {
      session_id: sessionId,
      slide_id: slideId,
      question_id: questionData.id,
      username: username,
      selected_option_ids: selectedOptionIds,
    };

    try {
      // TODO: Implement actual API call for submission
      await submitQuizAnswer(payload); // This is mocked in engageApi.ts
      setSubmissionCount(prev => prev + 1);
      toast.success("Answer Submitted!", {
        description: `Attempt ${submissionCount + 1} of ${studentAttemptsAllowed}.`,
      });
      if (submissionCount + 1 >= studentAttemptsAllowed) {
        toast.info("No more attempts", {
            description: "You have used all your attempts for this question.",
        });
      }
      // Optionally clear selection or disable form after max attempts
    } catch (e: any) {
      setError(e.message || "Failed to submit answer.");
      toast.error("Submission Failed", {
        description: e.message || "Could not submit your answer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper to safely render HTML content
  const createMarkup = (htmlContent: string) => {
    return { __html: htmlContent };
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg my-4">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl font-semibold text-slate-800">
          <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questionData.options.length > 0 ? (
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
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
         <p className="text-xs text-slate-500 text-right">
            Attempts: {submissionCount} / {studentAttemptsAllowed}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={!canAttempt || isSubmitting || selectedOptionIds.length === 0}
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