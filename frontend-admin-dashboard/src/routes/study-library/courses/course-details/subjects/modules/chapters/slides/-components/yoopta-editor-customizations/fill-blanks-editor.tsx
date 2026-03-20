import { useState, useEffect, useMemo, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';

// Pattern: {blank:answer}
const BLANK_REGEX = /\{blank:([^}]+)\}/g;

interface ParsedPart {
    type: 'text' | 'blank';
    value: string; // For text: the text. For blank: the answer.
}

function parseSentence(sentence: string): ParsedPart[] {
    const parts: ParsedPart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const regex = new RegExp(BLANK_REGEX.source, 'g');
    while ((match = regex.exec(sentence)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', value: sentence.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'blank', value: match[1]! });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < sentence.length) {
        parts.push({ type: 'text', value: sentence.slice(lastIndex) });
    }
    return parts;
}

export function FillBlanksBlock({
    element,
    attributes,
    children,
    blockId,
}: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const [sentence, setSentence] = useState(element?.props?.sentence || '');
    const [isEditing, setIsEditing] = useState(!element?.props?.sentence);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [showResults, setShowResults] = useState(false);
    const isFirstRender = useRef(true);

    const parts = useMemo(() => parseSentence(sentence), [sentence]);
    const blanks = useMemo(() => parts.filter((p) => p.type === 'blank'), [parts]);

    // Persist state
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'fillBlanks',
            props: {
                ...element.props,
                sentence,
                editorType: 'fillBlanksEditor',
            },
        });
    }, [sentence]);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement | HTMLInputElement;
            if (target.value.length > 0 || target.selectionStart !== 0) {
                e.stopPropagation();
            }
        }
    };

    const checkAnswers = () => {
        setShowResults(true);
    };

    const resetAnswers = () => {
        setAnswers({});
        setShowResults(false);
    };

    let blankIndex = 0;

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
                    backgroundColor: '#f0f0f0',
                    borderBottom: '1px solid #e0e0e0',
                }}
            >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                    Fill in the Blanks
                </span>
                <button
                    onClick={() => {
                        setIsEditing(!isEditing);
                        resetAnswers();
                    }}
                    style={{
                        padding: '3px 10px',
                        fontSize: '12px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#666',
                        cursor: 'pointer',
                    }}
                >
                    {isEditing ? 'Preview' : 'Edit'}
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '12px' }}>
                {isEditing ? (
                    <div>
                        <div
                            style={{
                                fontSize: '12px',
                                color: '#666',
                                marginBottom: '8px',
                                padding: '8px',
                                backgroundColor: '#e8f4fd',
                                borderRadius: '4px',
                                lineHeight: 1.6,
                            }}
                        >
                            Use <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '3px', fontSize: '12px' }}>{'{blank:answer}'}</code> to create blanks.
                            <br />
                            Example: <em>The capital of France is {'{blank:Paris}'}</em>
                        </div>
                        <textarea
                            value={sentence}
                            onChange={(e) => setSentence(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder="The {blank:Sun} is the center of our {blank:solar system}."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: '10px',
                                fontSize: '14px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: 'inherit',
                            }}
                        />
                        {blanks.length > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                {blanks.length} blank{blanks.length > 1 ? 's' : ''} detected:{' '}
                                {blanks.map((b, i) => (
                                    <span key={i}>
                                        <strong>{b.value}</strong>
                                        {i < blanks.length - 1 ? ', ' : ''}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        {/* Rendered sentence with blanks */}
                        <div
                            style={{
                                fontSize: '16px',
                                lineHeight: 2.2,
                                color: '#333',
                                padding: '8px',
                            }}
                        >
                            {parts.map((part, i) => {
                                if (part.type === 'text') {
                                    return <span key={i}>{part.value}</span>;
                                }
                                const idx = blankIndex++;
                                const userAnswer = answers[idx] || '';
                                const isCorrect =
                                    userAnswer.trim().toLowerCase() ===
                                    part.value.trim().toLowerCase();

                                return (
                                    <span key={i} style={{ display: 'inline-block', margin: '0 4px' }}>
                                        <input
                                            type="text"
                                            value={userAnswer}
                                            onChange={(e) => {
                                                setAnswers((prev) => ({
                                                    ...prev,
                                                    [idx]: e.target.value,
                                                }));
                                                setShowResults(false);
                                            }}
                                            onKeyDown={handleInputKeyDown}
                                            placeholder={`blank ${idx + 1}`}
                                            style={{
                                                width: `${Math.max(part.value.length * 10, 80)}px`,
                                                padding: '4px 8px',
                                                fontSize: '15px',
                                                border: 'none',
                                                borderBottom: showResults
                                                    ? `2px solid ${isCorrect ? '#22c55e' : '#ef4444'}`
                                                    : '2px solid #007acc',
                                                backgroundColor: showResults
                                                    ? isCorrect
                                                        ? '#f0fdf4'
                                                        : '#fef2f2'
                                                    : '#f8f9fa',
                                                outline: 'none',
                                                textAlign: 'center',
                                                borderRadius: '2px 2px 0 0',
                                            }}
                                        />
                                        {showResults && !isCorrect && (
                                            <div
                                                style={{
                                                    fontSize: '11px',
                                                    color: '#ef4444',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {part.value}
                                            </div>
                                        )}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Check / Reset buttons */}
                        {blanks.length > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '12px',
                                    justifyContent: 'center',
                                }}
                            >
                                <button
                                    onClick={checkAnswers}
                                    style={{
                                        padding: '6px 16px',
                                        fontSize: '13px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: '#007acc',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Check Answers
                                </button>
                                <button
                                    onClick={resetAnswers}
                                    style={{
                                        padding: '6px 16px',
                                        fontSize: '13px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        backgroundColor: 'white',
                                        color: '#666',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Reset
                                </button>
                                {showResults && (
                                    <span
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: '13px',
                                            color:
                                                Object.keys(answers).length === blanks.length &&
                                                blanks.every(
                                                    (b, i) =>
                                                        (answers[i] || '').trim().toLowerCase() ===
                                                        b.value.trim().toLowerCase()
                                                )
                                                    ? '#22c55e'
                                                    : '#666',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {blanks.filter(
                                            (b, i) =>
                                                (answers[i] || '').trim().toLowerCase() ===
                                                b.value.trim().toLowerCase()
                                        ).length}
                                        /{blanks.length} correct
                                    </span>
                                )}
                            </div>
                        )}

                        {!sentence.trim() && (
                            <div
                                onClick={() => setIsEditing(true)}
                                style={{
                                    padding: '20px',
                                    textAlign: 'center',
                                    color: '#999',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                }}
                            >
                                Click Edit to add a fill-in-the-blanks sentence
                            </div>
                        )}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}

// Fill Blanks Icon
const FillBlanksIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="18" x2="8" y2="18" />
        <line x1="10" y1="18" x2="21" y2="18" />
        <rect x="8" y="14" width="4" height="8" rx="1" fill="none" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
);

// Yoopta Plugin Definition
export const FillBlanksPlugin = new YooptaPlugin<{ fillBlanks: any }>({
    type: 'fillBlanks',
    elements: {
        fillBlanks: {
            render: FillBlanksBlock,
        },
    },
    options: {
        display: {
            title: 'Fill in the Blanks',
            description: 'Interactive sentence completion exercise',
            icon: <FillBlanksIcon />,
        },
        shortcuts: ['blanks', 'fill', 'cloze'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'fillBlanks') {
                        return undefined;
                    }
                    const sentence = element.getAttribute('data-sentence') || '';
                    return {
                        id: `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'fillBlanks',
                        props: { sentence, editorType: 'fillBlanksEditor' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                const props = element.props || {};
                const sentence = props.sentence || '';
                const escapedSentence = sentence.replace(/"/g, '&quot;');

                // Render visual preview with underlines for blanks
                const displayHtml = sentence
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(
                        /\{blank:([^}]+)\}/g,
                        '<span style="display: inline-block; min-width: 80px; border-bottom: 2px solid #007acc; text-align: center; padding: 2px 8px; margin: 0 4px; color: transparent;" data-answer="$1">$1</span>'
                    );

                return `<div data-yoopta-type="fillBlanks" data-editor-type="fillBlanksEditor" data-sentence="${escapedSentence}" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 8px 0; background: #fafafa;"><div style="font-weight: 600; font-size: 13px; color: #666; margin-bottom: 8px;">Fill in the Blanks</div><div style="font-size: 16px; line-height: 2.2; color: #333;">${displayHtml}</div></div>`;
            },
        },
    },
});
