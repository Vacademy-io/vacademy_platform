import React, { useState } from "react";

interface Option {
  id: string;
  text: { content: string };
}

interface Question {
  id: string;
  parent_rich_text?: {
    id?: string;
    type?: string;
    content?: string;
  };
  text?: {
    id?: string;
    type?: string;
    content?: string;
  } | string;
  text_data?: {
    id?: string;
    type?: string;
    content?: string;
  };
  options: Option[];
  question_type?: string;
  explanation_text?: {
    id?: string;
    type?: string;
    content?: string;
  };
  auto_evaluation_json?: string;
}

interface QuizReviewProps {
  questions: Question[];
  userAnswers: { [questionId: string]: string | number | string[] };
  onRestart: () => void;
}

const getQuestionText = (q: Question) => {
  if (q.text && typeof q.text === 'object' && q.text.content) return q.text.content;
  if (q.text_data?.content) return q.text_data.content;
  if (typeof q.text === 'string') return q.text;
  return "";
};

const getPassageText = (q: Question) => q.parent_rich_text?.content || "";
const getExplanationText = (q: Question) => q.explanation_text?.content || "";

// Helper to render comma-separated React elements
function renderCommaSeparated(elements: React.ReactNode[]) {
  return elements.flatMap((el, idx) =>
    idx === 0 ? [el] : [<span key={`sep-${idx}`}>, </span>, el]
  );
}

const getOptionHtml = (q: Question, idOrValue: string | number | undefined) => {
  // ✅ Handle undefined/null values
  if (idOrValue === undefined || idOrValue === null || idOrValue === '') {
    return "No answer selected";
  }
  
  if (q.options && q.options.length > 0 && typeof idOrValue === 'string') {
    const opt = q.options.find(o => o.id === idOrValue);
    if (opt) return opt.text.content;
  }
  
  return String(idOrValue);
};

const getCorrectAnswers = (q: Question): (string | number)[] => {
  if (q.auto_evaluation_json) {
    try {
      const parsed = JSON.parse(q.auto_evaluation_json);
      if (Array.isArray(parsed.correctAnswers)) {
        if (typeof parsed.correctAnswers[0] === 'number' && q.options?.length) {
          return parsed.correctAnswers.map((idx: number) => q.options[idx]?.id ?? idx);
        }
        return parsed.correctAnswers;
      }
      if (typeof parsed.correctAnswers === 'string' || typeof parsed.correctAnswers === 'number') {
        return [parsed.correctAnswers];
      }
      // Handle { data: { answer: ... } }
      if (parsed.data) {
        if (typeof parsed.data.answer === 'string' || typeof parsed.data.answer === 'number') {
          return [parsed.data.answer];
        }
        if (parsed.data.answer && typeof parsed.data.answer === 'object' && typeof parsed.data.answer.content === 'string') {
          // For LONG_ANSWER: answer is in content (HTML string)
          return [parsed.data.answer.content];
        }
      }
    } catch {
      // ignore
    }
  }
  return [];
};

export const QuizReview: React.FC<QuizReviewProps> = ({ questions, userAnswers, onRestart }) => {
  const [showFullPassageIdx, setShowFullPassageIdx] = useState<number | null>(null);
  const PASSAGE_LIMIT = 200;

  // Helper to get plain text from HTML
  const getPlainText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  // Inline SVG for checkmark
  const CheckIcon = () => (
    <svg className="inline-block mr-1 text-green-600" width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 10.5L9 14.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // Inline SVG for user icon
  const UserIcon = () => (
    <svg className="inline-block mr-1 text-blue-600" width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M2 18c0-2.21 3.582-4 8-4s8 1.79 8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  // Helper to get option label (a), b), c), ...)
  const getOptionLabel = (idx: number) => String.fromCharCode(97 + idx) + ") ";

  return (
    <div className="w-full min-h-[80vh] bg-white rounded-xl shadow-lg p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        {/* <span className="inline-block bg-primary-100 text-primary-700 text-base font-semibold px-4 py-1 rounded-full shadow-sm border border-primary-200">
          Quiz Review
        </span> */}
        <h2 className="text-primary-800 text-base font-bold ">Quiz Review</h2>
        <button
          className="px-4 py-2 bg-secondary-500 hover:bg-primary-100 text-black font-semibold text-xs border rounded shadow transition-colors"
          onClick={onRestart}
          type="button"
        >
          Restart
        </button>
      </div>
      <div className="space-y-10">
        {questions.map((q, idx) => {
          const passage = getPassageText(q);
          const questionText = getQuestionText(q);
          const explanation = getExplanationText(q);
          const userAnswer = userAnswers[q.id];
          const correctAnswers = getCorrectAnswers(q);
          const isMulti = Array.isArray(userAnswer);

          // Passage show more/less logic
          const passagePlain = getPlainText(passage);
          const isPassageLong = passagePlain.length > PASSAGE_LIMIT;
          const showFull = showFullPassageIdx === idx;
          const passageToShow = showFull || !isPassageLong
            ? passage
            : passagePlain.slice(0, PASSAGE_LIMIT) + "...";

          // For MCQ/Multiple, show option labels
          const isMCQ = Array.isArray(q.options) && q.options.length > 1 && q.options[0]?.id;

          // For 'Your Answer', get the index in q.options for each selected id
          const getUserAnswerWithIndex = () => {
            if (isMulti && isMCQ) {
              return (userAnswer as (string | number)[]).map((id) => {
                const idx = q.options.findIndex(opt => opt.id === id);
                return { id, idx };
              });
            } else if (isMCQ) {
              const idx = q.options.findIndex(opt => opt.id === userAnswer);
              return [{ id: userAnswer, idx }];
            }
            return null;
          };

          // For 'Correct Answer', sort by q.options order if MCQ
          const getCorrectAnswerWithIndex = () => {
            if (isMCQ) {
              return q.options
                .map((opt, idx) => correctAnswers.includes(opt.id) ? { id: opt.id, idx } : null)
                .filter(Boolean);
            }
            return correctAnswers.map((id) => ({ id, idx: 0 }));
          };

          const userAnswerWithIndex = getUserAnswerWithIndex();
          const correctAnswerWithIndex = getCorrectAnswerWithIndex();

          return (
            <div key={q.id} className="p-6 rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
              <div className="mb-2 text-xs text-gray-500 font-medium">Question {idx + 1}</div>
              {passage && (
                <div className="mb-4 p-4 bg-gray-100 rounded border border-gray-200">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Passage:</div>
                  <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: passageToShow }} />
                  {isPassageLong && (
                    <button
                      className="mt-2 text-primary-600 hover:underline text-xs font-medium focus:outline-none"
                      onClick={() => setShowFullPassageIdx(showFull ? null : idx)}
                      type="button"
                    >
                      {showFull ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}
              <div className="mb-4">
                <span className="font-semibold text-gray-700">Q:</span>{" "}
                <span className="text-gray-900 text-xs" dangerouslySetInnerHTML={{ __html: questionText }} />
              </div>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <div className="mb-1 text-xs font-semibold text-blue-800 flex items-center"><UserIcon />Your Answer</div>
                  <div className="w-full rounded-lg bg-blue-50 border border-blue-200 p-3 flex flex-col gap-2">
                    {/* ✅ Check if userAnswer exists before rendering */}
                    {!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0) ? (
                      <span className="text-gray-500 italic text-sm">No answer selected</span>
                    ) : isMCQ && userAnswerWithIndex
                      ? userAnswerWithIndex.map(({ id, idx }) => (
                          <span key={id as string} className="text-blue-900 text-sm flex items-center">
                            <span className="font-bold mr-1">{getOptionLabel(idx)}</span>
                            <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                          </span>
                        ))
                      : isMulti
                        ? (userAnswer as (string | number)[]).map((id) => (
                            <span key={id as string} className="text-blue-900 text-sm flex items-center">
                              <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                            </span>
                          ))
                        : <span className="text-blue-900 text-sm flex items-center">
                            <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, userAnswer) }} />
                          </span>}
                  </div>
                </div>
                {correctAnswers.length > 0 && (
                  <div className="flex-1">
                    <div className="mb-1 text-xs font-semibold text-green-800 flex items-center"><CheckIcon />Correct Answer</div>
                    <div className="w-full rounded-lg bg-green-50 border border-green-200 p-3 flex flex-col gap-2">
                      {isMCQ && correctAnswerWithIndex
                        ? correctAnswerWithIndex.map(({ id, idx }) => (
                            <span key={id as string} className="text-green-900 text-sm flex items-center">
                              <span className="font-bold mr-1">{getOptionLabel(idx)}</span>
                              <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                            </span>
                          ))
                        : correctAnswers.map((id) => (
                            <span key={id as string} className="text-green-900 text-sm flex items-center">
                              <span dangerouslySetInnerHTML={{ __html: getOptionHtml(q, id) }} />
                            </span>
                          ))}
                    </div>
                  </div>
                )}
              </div>
              {explanation && (
                <div className="mt-2 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <div className="mb-1 text-xs font-semibold text-gray-700">Explanation</div>
                  <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: explanation }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuizReview; 