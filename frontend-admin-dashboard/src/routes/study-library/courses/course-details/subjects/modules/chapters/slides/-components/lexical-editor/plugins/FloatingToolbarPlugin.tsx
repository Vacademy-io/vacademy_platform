import { useCallback, useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    type TextFormatType,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
    TextB,
    TextItalic,
    TextUnderline,
    TextStrikethrough,
    HighlighterCircle,
    Code,
    LinkSimple,
    Check,
    X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/** Selection-anchored formatting toolbar: bold / italic / underline /
 *  strikethrough / highlight / inline code / link. */
export function FloatingToolbarPlugin() {
    const [editor] = useLexicalComposerContext();
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [formats, setFormats] = useState<Set<string>>(new Set());
    const [isLink, setIsLink] = useState(false);
    const [linkEditing, setLinkEditing] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed() || !editor.isEditable()) {
            setVisible(false);
            setLinkEditing(false);
            return;
        }
        const nativeSelection = window.getSelection();
        if (!nativeSelection || nativeSelection.rangeCount === 0) {
            setVisible(false);
            return;
        }
        const range = nativeSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            setVisible(false);
            return;
        }
        const next = new Set<string>();
        (['bold', 'italic', 'underline', 'strikethrough', 'highlight', 'code'] as const).forEach(
            (f) => {
                if (selection.hasFormat(f)) next.add(f);
            }
        );
        setFormats(next);
        const node = selection.anchor.getNode();
        const linkParent = $findMatchingParent(node, $isLinkNode);
        setIsLink(!!linkParent);
        setPosition({
            top: rect.top + window.scrollY - 44,
            left: Math.max(8, rect.left + window.scrollX + rect.width / 2 - 140),
        });
        setVisible(true);
    }, [editor]);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => updateToolbar());
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    editor.getEditorState().read(() => updateToolbar());
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, updateToolbar]);

    if (!visible) return null;

    const buttons: Array<{ format: TextFormatType; icon: React.ReactNode; label: string }> = [
        { format: 'bold', icon: <TextB size={16} />, label: 'Bold' },
        { format: 'italic', icon: <TextItalic size={16} />, label: 'Italic' },
        { format: 'underline', icon: <TextUnderline size={16} />, label: 'Underline' },
        { format: 'strikethrough', icon: <TextStrikethrough size={16} />, label: 'Strikethrough' },
        { format: 'highlight', icon: <HighlighterCircle size={16} />, label: 'Highlight' },
        { format: 'code', icon: <Code size={16} />, label: 'Inline code' },
    ];

    return ReactDOM.createPortal(
        <div
            ref={toolbarRef}
            className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.preventDefault() /* keep the text selection */}
        >
            {linkEditing ? (
                <div className="flex items-center gap-1 px-1">
                    <input
                        autoFocus
                        type="url"
                        placeholder="https://…"
                        className="w-52 rounded-sm border border-neutral-200 px-2 py-1 text-caption outline-none"
                        value={linkDraft}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkDraft || null);
                                setLinkEditing(false);
                            }
                            if (e.key === 'Escape') setLinkEditing(false);
                        }}
                    />
                    <button
                        type="button"
                        aria-label="Apply link"
                        className="rounded-sm p-1 text-success-600"
                        onClick={() => {
                            editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkDraft || null);
                            setLinkEditing(false);
                        }}
                    >
                        <Check size={16} />
                    </button>
                    <button
                        type="button"
                        aria-label="Cancel"
                        className="rounded-sm p-1 text-neutral-500"
                        onClick={() => setLinkEditing(false)}
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <>
                    {buttons.map((b) => (
                        <button
                            key={b.format}
                            type="button"
                            aria-label={b.label}
                            title={b.label}
                            className={cn(
                                'rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100',
                                formats.has(b.format) && 'bg-primary-50 text-primary-500'
                            )}
                            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, b.format)}
                        >
                            {b.icon}
                        </button>
                    ))}
                    <button
                        type="button"
                        aria-label="Link"
                        title="Link"
                        className={cn(
                            'rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100',
                            isLink && 'bg-primary-50 text-primary-500'
                        )}
                        onClick={() => {
                            if (isLink) {
                                editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                            } else {
                                setLinkDraft('');
                                setLinkEditing(true);
                            }
                        }}
                    >
                        <LinkSimple size={16} />
                    </button>
                </>
            )}
        </div>,
        document.body
    );
}
