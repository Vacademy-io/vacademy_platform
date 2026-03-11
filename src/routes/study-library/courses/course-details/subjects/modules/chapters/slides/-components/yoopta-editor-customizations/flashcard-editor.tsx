import { useState, useEffect, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';

export function FlashcardBlock({
    element,
    attributes,
    children,
    blockId,
}: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const [front, setFront] = useState(element?.props?.front || '');
    const [back, setBack] = useState(element?.props?.back || '');
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditing, setIsEditing] = useState(!element?.props?.front);
    const isFirstRender = useRef(true);

    // Persist state to Yoopta/Slate store
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'flashcard',
            props: {
                ...element.props,
                front,
                back,
                editorType: 'flashcardEditor',
            },
        });
    }, [front, back]);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement;
            if (target.value.length > 0 || target.selectionStart !== 0) {
                e.stopPropagation();
            }
        }
    };

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
                    Flashcard
                </span>
                <button
                    onClick={() => setIsEditing(!isEditing)}
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
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Front side */}
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#666',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Front (Question / Term)
                            </div>
                            <textarea
                                value={front}
                                onChange={(e) => setFront(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Enter the question or term..."
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
                                }}
                            />
                        </div>
                        {/* Back side */}
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#666',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Back (Answer / Definition)
                            </div>
                            <textarea
                                value={back}
                                onChange={(e) => setBack(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Enter the answer or definition..."
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
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    /* Preview - Flip Card */
                    <div
                        style={{ perspective: '1000px', cursor: 'pointer' }}
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        <div
                            style={{
                                position: 'relative',
                                width: '100%',
                                minHeight: '150px',
                                transition: 'transform 0.6s',
                                transformStyle: 'preserve-3d',
                                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            }}
                        >
                            {/* Front */}
                            <div
                                style={{
                                    position: 'absolute',
                                    width: '100%',
                                    minHeight: '150px',
                                    backfaceVisibility: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '24px',
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: '2px solid #007acc',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        left: '12px',
                                        fontSize: '10px',
                                        color: '#007acc',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Front
                                </div>
                                <div
                                    style={{
                                        fontSize: '16px',
                                        color: '#333',
                                        textAlign: 'center',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {front || (
                                        <span style={{ color: '#ccc', fontStyle: 'italic' }}>
                                            No content
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        fontSize: '11px',
                                        color: '#999',
                                    }}
                                >
                                    Click to flip
                                </div>
                            </div>

                            {/* Back */}
                            <div
                                style={{
                                    position: 'absolute',
                                    width: '100%',
                                    minHeight: '150px',
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '24px',
                                    backgroundColor: '#007acc',
                                    borderRadius: '8px',
                                    border: '2px solid #007acc',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        left: '12px',
                                        fontSize: '10px',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Back
                                </div>
                                <div
                                    style={{
                                        fontSize: '16px',
                                        color: '#fff',
                                        textAlign: 'center',
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {back || (
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                                            No content
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        fontSize: '11px',
                                        color: 'rgba(255,255,255,0.6)',
                                    }}
                                >
                                    Click to flip back
                                </div>
                            </div>
                        </div>
                        {/* Spacer to maintain layout height since cards are position:absolute */}
                        <div style={{ minHeight: '150px' }} />
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}

// Flashcard Icon
const FlashcardIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="3 3" />
    </svg>
);

// Yoopta Plugin Definition
export const FlashcardPlugin = new YooptaPlugin<{ flashcard: any }>({
    type: 'flashcard',
    elements: {
        flashcard: {
            render: FlashcardBlock,
        },
    },
    options: {
        display: {
            title: 'Flashcard',
            description: 'Flip card with front and back sides',
            icon: <FlashcardIcon />,
        },
        shortcuts: ['flashcard', 'flip', 'card'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'flashcard') {
                        return undefined;
                    }
                    const front = element.getAttribute('data-front') || '';
                    const back = element.getAttribute('data-back') || '';
                    return {
                        id: `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'flashcard',
                        props: { front, back, editorType: 'flashcardEditor' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                const props = element.props || {};
                const front = props.front || '';
                const back = props.back || '';
                const escapedFront = front.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>');
                const escapedBack = back.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br/>');

                return `<div data-yoopta-type="flashcard" data-editor-type="flashcardEditor" data-front="${front.replace(/"/g, '&quot;')}" data-back="${back.replace(/"/g, '&quot;')}" style="border: 2px solid #007acc; border-radius: 8px; margin: 8px 0; overflow: hidden; cursor: pointer;"><div style="padding: 24px; text-align: center; background: #fff;"><div style="font-size: 10px; color: #007acc; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">Front</div><div style="font-size: 16px; color: #333;">${escapedFront}</div></div><div style="border-top: 2px dashed #007acc; padding: 24px; text-align: center; background: #f0f7ff;"><div style="font-size: 10px; color: #007acc; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">Back</div><div style="font-size: 16px; color: #333;">${escapedBack}</div></div></div>`;
            },
        },
    },
});
