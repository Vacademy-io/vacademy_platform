// src/components/QuizInteraction.tsx
import React, { useState, useEffect, useRef } from 'react';
import { type AddedQuestion, type Option } from '@/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox'; // For multiple choice if needed
import { toast } from 'sonner';
import { Loader2, Send, Hourglass, Clock, AlertTriangle } from 'lucide-react';
import { GlassmorphismInput } from '@/components/ui/input'; // Added Input
import { Textarea } from '@/components/ui/textarea'; // Added Textarea

// Define BASE_URL - move to a config file or env variable later
const BASE_URL = 'https://backend-stage.vacademy.io';

interface QuizInteractionProps {
  questionData: AddedQuestion;
  sessionId: string;
  slideId: string;
  username: string;
  studentAttemptsAllowed: number;
  defaultSecondsForQuestion: number;
  slideStartTimestamp: number | null;
}

// Countdown Timer Component
const CountdownTimer: React.FC<{ secondsRemaining: number; totalSeconds: number; isExpired: boolean }> = ({
  secondsRemaining,
  totalSeconds,
  isExpired,
}) => {
  const percentage = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 22; // radius = 22
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (isExpired) return 'text-red-500';
    if (secondsRemaining <= 5) return 'text-red-400';
    if (secondsRemaining <= 15) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getStrokeColor = () => {
    if (isExpired) return '#ef4444';
    if (secondsRemaining <= 5) return '#f87171';
    if (secondsRemaining <= 15) return '#fbbf24';
    return '#34d399';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getColor()}`}>
          {isExpired ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            secondsRemaining
          )}
        </div>
      </div>
      {isExpired ? (
        <span className="text-red-400 text-sm font-semibold animate-pulse">Time's up!</span>
      ) : (
        <span className={`text-sm font-medium ${getColor()}`}>
          {secondsRemaining}s
        </span>
      )}
    </div>
  );
};

export const QuizInteraction: React.FC<QuizInteractionProps> = ({
  questionData,
  sessionId,
  slideId,
  username,
  studentAttemptsAllowed,
  defaultSecondsForQuestion,
  slideStartTimestamp,
}) => {
  console.log('[QuizInteraction] Received questionData.id:', questionData.id);

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now());
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(defaultSecondsForQuestion);
  const [isTimerExpired, setIsTimerExpired] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const questionCategory = (type: string | undefined) => {
    if (!type) return 'unknown';
    const upperType = type.toUpperCase();
    if (upperType === 'MCQS' || upperType === 'MCQM') return 'multiple_choice';
    if (upperType === 'ONE_WORD' || upperType === 'LONG_ANSWER' || upperType === 'NUMERICAL') return 'text_input';
    return 'unknown';
  };

  const currentQuestionCategory = questionCategory(questionData.question_type);
  const isMultipleChoice = questionData.question_type?.toUpperCase() === 'MCQM';
  const canAttempt = submissionCount < studentAttemptsAllowed && !isTimerExpired;

  // Timer logic
  useEffect(() => {
    // Clear previous timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Only run timer for question slides with a time limit
    const isQuestionSlide = currentQuestionCategory === 'multiple_choice' || currentQuestionCategory === 'text_input';
    if (!isQuestionSlide || defaultSecondsForQuestion <= 0) {
      setIsTimerExpired(false);
      setSecondsRemaining(0);
      return;
    }

    // Calculate remaining seconds based on server timestamp
    const startTs = slideStartTimestamp || Date.now();
    const elapsedMs = Date.now() - startTs;
    const elapsedSecs = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, defaultSecondsForQuestion - elapsedSecs);

    setSecondsRemaining(remaining);
    setIsTimerExpired(remaining <= 0);

    if (remaining <= 0) return;

    timerIntervalRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setIsTimerExpired(true);
          toast.warning("Time's up!", { description: "You can no longer submit an answer for this question." });
          return 0;
        }
        // Flash warning at 10 and 5 seconds
        if (next === 10) toast.info("⏰ 10 seconds remaining!");
        if (next === 5) toast.warning("⚠️ Only 5 seconds left!");
        return next;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [questionData.id, slideStartTimestamp, defaultSecondsForQuestion, currentQuestionCategory]);

  useEffect(() => {
    // Reset selection and answer when question changes
    toast.dismiss(); // Clear all toasts from previous question
    setSelectedOptionIds([]);
    setTextAnswer('');
    setResponseStartTime(Date.now());
    setSubmissionCount(0);
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

    if (isTimerExpired) {
      setError("Time limit exceeded. Cannot submit.");
      return;
    }

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

    // Normalize NUMERICAL → NUMERIC so backend evaluateResponse switch matches
    const rawType = questionData.question_type!.toUpperCase();
    const responseTypeStr = rawType === 'NUMERICAL' ? 'NUMERIC' : rawType;

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
        setResponseStartTime(Date.now());
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

  // Timer expired state
  if (isTimerExpired && submissionCount === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto glassmorphism-container my-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 to-orange-900/20 rounded-2xl pointer-events-none" />
        <CardHeader className="p-4 relative z-10">
          <CardTitle className="text-lg font-semibold text-white max-h-[25vh] overflow-y-auto">
             <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question")} />
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 relative z-10">
          <div className="flex items-center justify-center w-16 h-16 bg-red-400/20 border border-red-300/30 rounded-full backdrop-blur-sm mx-auto mb-4">
            <Clock className="size-8 text-red-400" />
          </div>
          <p className="text-lg font-medium text-red-300">
            Time's up!
          </p>
          <p className="text-sm text-white/60 mt-1">
            You did not submit an answer in time.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canAttempt && !isTimerExpired) {
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
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg font-semibold text-white max-h-[30vh] overflow-y-auto flex-1">
            <span dangerouslySetInnerHTML={createMarkup(questionData.text?.content || "Question")} />
          </CardTitle>
          {/* Countdown Timer */}
          {defaultSecondsForQuestion > 0 && !isTimerExpired && (
            <CountdownTimer
              secondsRemaining={secondsRemaining}
              totalSeconds={defaultSecondsForQuestion}
              isExpired={isTimerExpired}
            />
          )}
        </div>
        {questionData.question_type && <p className="text-sm text-white/70 pt-1">Type: {questionData.question_type}</p>}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 max-h-[45vh] overflow-y-auto relative z-10">
        {currentQuestionCategory === 'multiple_choice' ? (
          questionData.options.length > 0 ? (
            isMultipleChoice ? (
              // MCQM: plain div wrapper — Checkbox handles its own state; RadioGroup is semantically wrong here
              <div className="space-y-3">
                {questionData.options.map((option: Option) => (
                  <div
                    key={option.id}
                    className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 ease-out backdrop-blur-sm
                                ${selectedOptionIds.includes(option.id) ? 'border-orange-400/50 bg-orange-900/40 ring-2 ring-orange-400/30' : 'border-white/30 bg-black/40 hover:border-white/40 hover:bg-black/50'}
                                ${(!canAttempt || isSubmitting) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                  >
                    <Checkbox
                      id={`option-${option.id}`}
                      checked={selectedOptionIds.includes(option.id)}
                      onCheckedChange={() => canAttempt && !isSubmitting && handleOptionChange(option.id)}
                      disabled={!canAttempt || isSubmitting}
                      className="size-4"
                    />
                    <Label htmlFor={`option-${option.id}`} className={`flex-1 text-sm font-medium ${(!canAttempt || isSubmitting) ? 'text-white/50' : 'text-white'} cursor-pointer`}
                      dangerouslySetInnerHTML={createMarkup(option.text.content || `Option ${option.option_order || ''}`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              // MCQS: RadioGroup ensures only one option is selected at a time
              <RadioGroup
                onValueChange={(value: string) => handleOptionChange(value)}
                value={selectedOptionIds[0] || ''}
                disabled={!canAttempt || isSubmitting}
                className="space-y-3"
              >
                {questionData.options.map((option: Option) => (
                  <label
                    key={option.id}
                    htmlFor={`option-${option.id}`}
                    className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 ease-out backdrop-blur-sm
                                ${selectedOptionIds.includes(option.id) ? 'border-orange-400/50 bg-orange-900/40 ring-2 ring-orange-400/30' : 'border-white/30 bg-black/40 hover:border-white/40 hover:bg-black/50'}
                                ${(!canAttempt || isSubmitting) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                  >
                    <RadioGroupItem
                      value={option.id}
                      id={`option-${option.id}`}
                      className="size-4 border-slate-400 data-[state=checked]:border-primary data-[state=checked]:text-primary focus:ring-primary"
                    />
                    <span className={`flex-1 text-sm font-medium ${(!canAttempt || isSubmitting) ? 'text-white/50' : 'text-white'} cursor-pointer`}
                      dangerouslySetInnerHTML={createMarkup(option.text.content || `Option ${option.option_order || ''}`)}
                    />
                  </label>
                ))}
              </RadioGroup>
            )
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
          ) : null
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
          disabled={!canAttempt || isSubmitting || isTimerExpired ||
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