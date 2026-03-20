import { useState, useEffect, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';

interface QuizOption {
    text: string;
    isCorrect: boolean;
}

interface QuizData {
    question: string;
    type: 'mcq' | 'trueFalse';
    options: QuizOption[];
    explanation: string;
}

const DEFAULT_MCQ: QuizData = {
    question: '',
    type: 'mcq',
    options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
    ],
    explanation: '',
};

const DEFAULT_TRUE_FALSE: QuizData = {
    question: '',
    type: 'trueFalse',
    options: [
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false },
    ],
    explanation: '',
};

export function QuizBlock({ element, attributes, children, blockId }: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const initialData: QuizData = element?.props?.quizData || { ...DEFAULT_MCQ, options: DEFAULT_MCQ.options.map(o => ({ ...o })) };
    const [quizData, setQuizData] = useState<QuizData>(initialData);
    const [isEditing, setIsEditing] = useState(!element?.props?.quizData?.question);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const isFirstRender = useRef(true);

    // Persist state to Yoopta/Slate store
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'quizBlock',
            props: {
                ...element.props,
                quizData,
                editorType: 'quizBlockEditor',
            },
        });
    }, [quizData]);

    const updateQuestion = (question: string) => {
        setQuizData((prev) => ({ ...prev, question }));
    };

    const updateExplanation = (explanation: string) => {
        setQuizData((prev) => ({ ...prev, explanation }));
    };

    const updateOptionText = (index: number, text: string) => {
        setQuizData((prev) => ({
            ...prev,
            options: prev.options.map((opt, i) => (i === index ? { ...opt, text } : opt)),
        }));
    };

    const toggleCorrect = (index: number) => {
        setQuizData((prev) => ({
            ...prev,
            options: prev.options.map((opt, i) => ({
                ...opt,
                isCorrect: i === index ? !opt.isCorrect : false, // single correct answer
            })),
        }));
    };

    const addOption = () => {
        if (quizData.options.length >= 6) return;
        setQuizData((prev) => ({
            ...prev,
            options: [...prev.options, { text: '', isCorrect: false }],
        }));
    };

    const removeOption = (index: number) => {
        if (quizData.options.length <= 2) return;
        setQuizData((prev) => ({
            ...prev,
            options: prev.options.filter((_, i) => i !== index),
        }));
    };

    const switchType = (type: 'mcq' | 'trueFalse') => {
        if (type === 'trueFalse') {
            setQuizData((prev) => ({
                ...prev,
                type,
                options: [
                    { text: 'True', isCorrect: false },
                    { text: 'False', isCorrect: false },
                ],
            }));
        } else {
            setQuizData((prev) => ({
                ...prev,
                type,
                options: DEFAULT_MCQ.options.map((o) => ({ ...o })),
            }));
        }
    };

    const handleCheckAnswer = () => {
        setShowResult(true);
    };

    const handleReset = () => {
        setSelectedAnswer(null);
        setShowResult(false);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const target = e.target as HTMLInputElement | HTMLTextAreaElement;
            if (target.value.length > 0 || target.selectionStart !== 0) {
                e.stopPropagation();
            }
        }
    };

    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

    return (
        <div
            {...attributes}
            contentEditable={false}
            style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                margin: '8px 0',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#eef2ff',
                    borderBottom: '1px solid #c7d2fe',
                }}
            >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#4338ca' }}>
                    Quiz Block
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {isEditing && (
                        <>
                            <button
                                onClick={() => switchType('mcq')}
                                style={{
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: '4px',
                                    backgroundColor: quizData.type === 'mcq' ? '#4338ca' : 'white',
                                    color: quizData.type === 'mcq' ? 'white' : '#666',
                                    cursor: 'pointer',
                                }}
                            >
                                MCQ
                            </button>
                            <button
                                onClick={() => switchType('trueFalse')}
                                style={{
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: '4px',
                                    backgroundColor: quizData.type === 'trueFalse' ? '#4338ca' : 'white',
                                    color: quizData.type === 'trueFalse' ? 'white' : '#666',
                                    cursor: 'pointer',
                                }}
                            >
                                True/False
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => {
                            setIsEditing(!isEditing);
                            handleReset();
                        }}
                        style={{
                            padding: '3px 10px',
                            fontSize: '12px',
                            border: '1px solid #c7d2fe',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            color: '#666',
                            cursor: 'pointer',
                        }}
                    >
                        {isEditing ? 'Preview' : 'Edit'}
                    </button>
                </div>
            </div>

            <div style={{ padding: '16px' }}>
                {isEditing ? (
                    /* Edit mode */
                    <div>
                        {/* Question */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>
                                Question
                            </label>
                            <textarea
                                value={quizData.question}
                                onChange={(e) => updateQuestion(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Enter your question..."
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        {/* Options */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>
                                Options (click the circle to mark correct answer)
                            </label>
                            {quizData.options.map((option, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '6px',
                                    }}
                                >
                                    {/* Correct toggle */}
                                    <button
                                        onClick={() => toggleCorrect(index)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            border: `2px solid ${option.isCorrect ? '#28a745' : '#ccc'}`,
                                            backgroundColor: option.isCorrect ? '#28a745' : 'white',
                                            color: option.isCorrect ? 'white' : '#ccc',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {option.isCorrect ? '✓' : optionLabels[index]}
                                    </button>

                                    <input
                                        type="text"
                                        value={option.text}
                                        onChange={(e) => updateOptionText(index, e.target.value)}
                                        onKeyDown={handleInputKeyDown}
                                        placeholder={`Option ${optionLabels[index]}`}
                                        disabled={quizData.type === 'trueFalse'}
                                        style={{
                                            flex: 1,
                                            padding: '6px 8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            backgroundColor: quizData.type === 'trueFalse' ? '#f5f5f5' : '#fff',
                                        }}
                                    />

                                    {quizData.type === 'mcq' && (
                                        <button
                                            onClick={() => removeOption(index)}
                                            disabled={quizData.options.length <= 2}
                                            style={{
                                                padding: '4px 8px',
                                                fontSize: '12px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                backgroundColor: '#fff',
                                                color: '#dc3545',
                                                cursor: quizData.options.length <= 2 ? 'default' : 'pointer',
                                                opacity: quizData.options.length <= 2 ? 0.3 : 1,
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}

                            {quizData.type === 'mcq' && quizData.options.length < 6 && (
                                <button
                                    onClick={addOption}
                                    style={{
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        border: '1px dashed #ccc',
                                        borderRadius: '4px',
                                        backgroundColor: '#fff',
                                        color: '#666',
                                        cursor: 'pointer',
                                        marginTop: '4px',
                                    }}
                                >
                                    + Add Option
                                </button>
                            )}
                        </div>

                        {/* Explanation */}
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>
                                Explanation (shown after answering)
                            </label>
                            <textarea
                                value={quizData.explanation}
                                onChange={(e) => updateExplanation(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Explain the correct answer..."
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    resize: 'vertical',
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    /* Preview / interactive mode */
                    <div>
                        {/* Question */}
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                            {quizData.question || 'No question set'}
                        </div>

                        {/* Options */}
                        <div style={{ marginBottom: '12px' }}>
                            {quizData.options.map((option, index) => {
                                let bgColor = '#fff';
                                let borderColor = '#ddd';
                                let textColor = '#333';

                                if (selectedAnswer === index) {
                                    borderColor = '#4338ca';
                                    bgColor = '#eef2ff';
                                }

                                if (showResult) {
                                    if (option.isCorrect) {
                                        bgColor = '#d4edda';
                                        borderColor = '#28a745';
                                        textColor = '#155724';
                                    } else if (selectedAnswer === index && !option.isCorrect) {
                                        bgColor = '#f8d7da';
                                        borderColor = '#dc3545';
                                        textColor = '#721c24';
                                    }
                                }

                                return (
                                    <div
                                        key={index}
                                        onClick={() => {
                                            if (!showResult) setSelectedAnswer(index);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '10px 12px',
                                            border: `2px solid ${borderColor}`,
                                            borderRadius: '6px',
                                            marginBottom: '6px',
                                            cursor: showResult ? 'default' : 'pointer',
                                            backgroundColor: bgColor,
                                            color: textColor,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            border: `2px solid ${borderColor}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            backgroundColor: selectedAnswer === index ? borderColor : 'transparent',
                                            color: selectedAnswer === index ? 'white' : textColor,
                                        }}>
                                            {showResult && option.isCorrect ? '✓' : optionLabels[index]}
                                        </span>
                                        <span style={{ fontSize: '14px' }}>
                                            {option.text || `Option ${optionLabels[index]}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {!showResult ? (
                                <button
                                    onClick={handleCheckAnswer}
                                    disabled={selectedAnswer === null}
                                    style={{
                                        padding: '6px 16px',
                                        fontSize: '13px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: selectedAnswer !== null ? '#4338ca' : '#ccc',
                                        color: 'white',
                                        cursor: selectedAnswer !== null ? 'pointer' : 'default',
                                    }}
                                >
                                    Check Answer
                                </button>
                            ) : (
                                <button
                                    onClick={handleReset}
                                    style={{
                                        padding: '6px 16px',
                                        fontSize: '13px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        backgroundColor: '#fff',
                                        color: '#666',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Try Again
                                </button>
                            )}
                        </div>

                        {/* Explanation */}
                        {showResult && quizData.explanation && (
                            <div
                                style={{
                                    marginTop: '12px',
                                    padding: '10px 12px',
                                    backgroundColor: '#fff3cd',
                                    border: '1px solid #ffc107',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    color: '#856404',
                                }}
                            >
                                <strong>Explanation:</strong> {quizData.explanation}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}

// Quiz icon
const QuizIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

// Yoopta Plugin Definition
export const QuizBlockPlugin = new YooptaPlugin<{ quizBlock: any }>({
    type: 'quizBlock',
    elements: {
        quizBlock: {
            render: QuizBlock,
        },
    },
    options: {
        display: {
            title: 'Quiz Block',
            description: 'Add an interactive quiz question',
            icon: <QuizIcon />,
        },
        shortcuts: ['quiz', 'question', 'mcq', 'test'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'quizBlock') {
                        return undefined;
                    }
                    let quizData: QuizData = DEFAULT_MCQ;
                    try {
                        const quizJson = element.getAttribute('data-quiz');
                        if (quizJson) {
                            quizData = JSON.parse(quizJson);
                        }
                    } catch {
                        // Use default
                    }
                    return {
                        id: `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'quizBlock',
                        props: { quizData, editorType: 'quizBlockEditor' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                const props = element.props || {};
                const quizData: QuizData = props.quizData || DEFAULT_MCQ;
                const quizJson = JSON.stringify(quizData).replace(/"/g, '&quot;');
                const questionEsc = quizData.question.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

                const optionsHtml = quizData.options
                    .map((opt, i) => {
                        const textEsc = opt.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 2px solid #ddd; border-radius: 6px; margin-bottom: 6px; background: #fff;">
              <span style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">${optionLabels[i]}</span>
              <span style="font-size: 14px;">${textEsc}</span>
            </div>`;
                    })
                    .join('');

                return `<div data-yoopta-type="quizBlock" data-editor-type="quizBlockEditor" data-quiz="${quizJson}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 8px 0; background: #fafafa;">
          <div style="padding: 4px 8px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; display: inline-block; font-size: 12px; font-weight: 600; color: #4338ca; margin-bottom: 12px;">QUIZ</div>
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 12px;">${questionEsc}</div>
          ${optionsHtml}
        </div>`;
            },
        },
    },
});
