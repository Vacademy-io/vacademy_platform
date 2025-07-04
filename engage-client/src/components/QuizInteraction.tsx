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
import { GlassmorphismInput } from '@/components/ui/input'; // Added Input
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
      <Card className="w-full max-w-2xl mx-auto glassmorphism-container my-4 animate-pulse relative overflow-hidden">
        {/* Yellow accent gradient overlay for completed state */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/20 to-amber-900/15 rounded-2xl pointer-events-none" />
        
        <CardHeader className="p-4 relative z-10">
          <CardTitle className="text-lg font-semibold text-white max-h-[25vh] overflow-y-auto">
             <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question Submitted")} />
          </CardTitle>
          <CardDescription className="text-white/70">You have used all your attempts.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 relative z-10">
          <div className="flex items-center justify-center w-16 h-16 bg-yellow-400/20 border border-yellow-300/30 rounded-full backdrop-blur-sm mx-auto mb-4">
            <Hourglass className="size-8 text-yellow-400" />
          </div>
          <p className="text-lg font-medium text-white/80">
            Waiting for the presenter to move to the next slide...
          </p>
        </CardContent>
        <CardFooter className="p-4 relative z-10">
          <p className="text-xs text-white/60 text-right w-full">
            Attempts: {submissionCount} / {studentAttemptsAllowed}
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto glassmorphism-container my-4 relative overflow-hidden">
      {/* Blue accent gradient overlay for active state */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-cyan-900/15 rounded-2xl pointer-events-none" />
      
      <CardHeader className="p-4 relative z-10">
        <CardTitle className="text-lg font-semibold text-white max-h-[30vh] overflow-y-auto">
          <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question")} />
        </CardTitle>
        {questionData.question_type && <p className="text-sm text-white/70 pt-1">Type: {questionData.question_type}</p>}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 max-h-[45vh] overflow-y-auto relative z-10">
        {currentQuestionCategory === 'multiple_choice' ? (
          questionData.options.length > 0 ? (
            <RadioGroup
              onValueChange={(value: string) => handleOptionChange(value)}
              value={isMultipleChoice ? undefined : selectedOptionIds[0]}
              disabled={!canAttempt || isSubmitting}
              className="space-y-3"
            >
              {questionData.options.map((option) => (
                <div
                  key={option.id}
                  className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 ease-out backdrop-blur-sm
                              ${selectedOptionIds.includes(option.id) ? 'border-orange-400/50 bg-orange-900/40 ring-2 ring-orange-400/30' : 'border-white/30 bg-black/40 hover:border-white/40 hover:bg-black/50'}
                              ${(!canAttempt || isSubmitting) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                  onClick={() => !isMultipleChoice && canAttempt && !isSubmitting && handleOptionChange(option.id)}
                >
                  {isMultipleChoice ? (
                    <Checkbox
                      id={`option-${option.id}`}
                      checked={selectedOptionIds.includes(option.id)}
                      onCheckedChange={() => handleOptionChange(option.id)}
                      disabled={!canAttempt || isSubmitting}
                      className="size-4"
                    />
                  ) : (
                    <RadioGroupItem
                      value={option.id}
                      id={`option-${option.id}`}
                      className="size-4 border-slate-400 data-[state=checked]:border-primary data-[state=checked]:text-primary focus:ring-primary"
                    />
                  )}
                  <Label htmlFor={`option-${option.id}`} className={`flex-1 text-sm font-medium ${(!canAttempt || isSubmitting) ? 'text-white/50' : 'text-white'} cursor-pointer`}
                    dangerouslySetInnerHTML={createMarkup(option.text.content || `Option ${option.option_order || ''}`)}
                  />
                </div>
              ))}
            </RadioGroup>
          ) : (
              <p className="text-white/60 text-center py-4">No options available for this question.</p>
          )
        ) : currentQuestionCategory === 'text_input' ? (
          questionData.question_type === 'ONE_WORD' || questionData.question_type === 'NUMERICAL' ? (
            <GlassmorphismInput 
              type={questionData.question_type === 'NUMERICAL' ? 'number' : 'text'}
              placeholder={`Your ${questionData.question_type === 'NUMERICAL' ? 'numerical' : 'one word'} answer`}
              value={textAnswer}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTextAnswer(e.target.value)}
              disabled={!canAttempt || isSubmitting}
              className="mt-2 bg-black/40 border-white/30 text-white placeholder:text-white/70"
            />
          ) : questionData.question_type === 'LONG_ANSWER' ? (
            <Textarea 
              placeholder="Your detailed answer..."
              value={textAnswer}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTextAnswer(e.target.value)}
              disabled={!canAttempt || isSubmitting}
              className="mt-2 min-h-[100px] bg-black/40 border border-white/30 text-white placeholder:text-white/70 focus:border-orange-400/50 focus:ring-orange-400/25 backdrop-blur-sm transition-all duration-300 ease-out hover:bg-black/50"
              rows={4}
            />
          ) : null // Should not reach here if currentQuestionCategory is 'text_input' and type is unknown
        ) : (
          <p className="text-white/60 text-center py-4">Unsupported question type: {questionData.question_type}</p>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 backdrop-blur-sm">
            <p className="text-sm font-medium text-red-300">{error}</p>
          </div>
        )}
        <p className="text-xs text-white/60 text-right">
          Attempts: {submissionCount} / {studentAttemptsAllowed}
        </p>
      </CardContent>
      <CardFooter className="p-4 relative z-10">
        <Button
          onClick={handleSubmit}
          disabled={!canAttempt || isSubmitting || 
            (currentQuestionCategory === 'multiple_choice' ? selectedOptionIds.length === 0 : false) ||
            (currentQuestionCategory === 'text_input' ? !textAnswer.trim() : false) ||
            (currentQuestionCategory === 'unknown')
          }
          className="w-full sm:w-auto sm:ml-auto h-10 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-semibold backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 shadow-lg shadow-green-500/25 border-0"
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