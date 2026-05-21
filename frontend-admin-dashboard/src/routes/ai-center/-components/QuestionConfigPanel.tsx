import { ArrowRight } from '@phosphor-icons/react';
import { languageSupport } from '@/constants/dummy-data';

export const QUESTION_TYPES = ['MCQ', 'True/False', 'Numeric', 'Short answer', 'Mixed'];
export const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];
export const NUM_PRESETS = ['5', '10', '20'];

export const buildQuestionPrompt = (
    num: string,
    type: string,
    difficulty: string,
    lang: string
): string => {
    const langLabel = lang === 'ENGLISH' ? 'English' : 'Hindi';
    const typeText = type === 'Mixed' ? 'questions of various types' : `${type} questions`;
    return `Generate ${num} ${typeText} in ${langLabel}. Difficulty: ${difficulty.toLowerCase()}.`;
};

type Props = {
    numQuestions: string;
    setNumQuestions: (v: string) => void;
    questionType: string;
    setQuestionType: (v: string) => void;
    difficulty: string;
    setDifficulty: (v: string) => void;
    language: string;
    setLanguage: (v: string) => void;
    onSubmit: () => void;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    secondary?: { label: string; onClick: () => void };
};

export const QuestionConfigPanel = ({
    numQuestions,
    setNumQuestions,
    questionType,
    setQuestionType,
    difficulty,
    setDifficulty,
    language,
    setLanguage,
    onSubmit,
    title = 'How would you like the questions?',
    subtitle = 'Tweak these or just use the defaults.',
    ctaLabel = 'Draft my paper',
    secondary,
}: Props) => {
    const canSubmit = numQuestions !== '' && Number(numQuestions) >= 1;

    return (
        <div className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                <p className="text-xs text-neutral-500">{subtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-neutral-600">How many?</label>
                    <div className="flex flex-wrap gap-1.5">
                        {NUM_PRESETS.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setNumQuestions(n)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    numQuestions === n
                                        ? 'border-primary-300 bg-primary-50 text-primary-600'
                                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                        <input
                            value={numQuestions}
                            onChange={(e) =>
                                setNumQuestions(e.target.value.replace(/\D/g, ''))
                            }
                            inputMode="numeric"
                            placeholder="custom"
                            className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-center text-xs focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-neutral-600">Difficulty</label>
                    <div className="flex gap-1.5">
                        {DIFFICULTY_LEVELS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDifficulty(d)}
                                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    difficulty === d
                                        ? 'border-primary-300 bg-primary-50 text-primary-600'
                                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-neutral-600">Question type</label>
                    <div className="flex flex-wrap gap-1.5">
                        {QUESTION_TYPES.map((q) => (
                            <button
                                key={q}
                                type="button"
                                onClick={() => setQuestionType(q)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    questionType === q
                                        ? 'border-primary-300 bg-primary-50 text-primary-600'
                                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-primary-200'
                                }`}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-neutral-600">Language</label>
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    >
                        {languageSupport.map((lang) => (
                            <option key={lang} value={lang}>
                                {lang.charAt(0) + lang.slice(1).toLowerCase()}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center">
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                    {ctaLabel}
                    <ArrowRight size={16} weight="bold" />
                </button>
                {secondary && (
                    <button
                        type="button"
                        onClick={secondary.onClick}
                        className="text-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
                    >
                        {secondary.label}
                    </button>
                )}
            </div>
        </div>
    );
};
