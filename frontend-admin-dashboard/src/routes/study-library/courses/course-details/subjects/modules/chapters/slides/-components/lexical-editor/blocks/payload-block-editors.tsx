import { useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { RichTextField, RichTextHtml } from '../../yoopta-editor-customizations/RichTextField';
import { cn } from '@/lib/utils';
import { Plus, Trash, CaretDown, CaretRight, ArrowsClockwise } from '@phosphor-icons/react';
import type {
    FlashcardPayload,
    TabsPayload,
    QuizPayload,
    TimelinePayload,
    ColumnsPayload,
    AccordionPayload,
    CodePayload,
    MultiLangCodePayload,
} from '../nodes/payload-nodes';

/** Editing UIs for the base64-payload blocks. Rich HTML sub-fields reuse the
 *  battle-tested RichTextField (shared with the legacy editor) — its output is
 *  exactly the rich-HTML dialect the learner app already renders. */

interface BlockEditorProps<T> {
    payload: T;
    setPayload: (next: T) => void;
    readOnly: boolean;
}

function BlockShell({
    title,
    children,
    actions,
}: {
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className="my-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-caption font-semibold text-neutral-600">{title}</span>
                {actions}
            </div>
            {children}
        </div>
    );
}

// ---------- Flashcard ----------
export function FlashcardBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<FlashcardPayload>) {
    const [flipped, setFlipped] = useState(false);

    if (readOnly) {
        return (
            <BlockShell
                title="Flashcard"
                actions={
                    <MyButton buttonType="text" scale="small" onClick={() => setFlipped(!flipped)}>
                        <ArrowsClockwise size={14} className="mr-1" /> Flip
                    </MyButton>
                }
            >
                <RichTextHtml html={flipped ? payload.back : payload.front} />
            </BlockShell>
        );
    }
    return (
        <BlockShell title="Flashcard">
            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <div className="mb-1 text-caption font-semibold text-primary-500">FRONT</div>
                    <div className="rounded-md border border-neutral-200 bg-white p-2">
                        <RichTextField
                            value={payload.front}
                            onChange={(html) => setPayload({ ...payload, front: html })}
                            placeholder="Front of the card…"
                            minHeight={60}
                        />
                    </div>
                </div>
                <div>
                    <div className="mb-1 text-caption font-semibold text-primary-500">BACK</div>
                    <div className="rounded-md border border-neutral-200 bg-white p-2">
                        <RichTextField
                            value={payload.back}
                            onChange={(html) => setPayload({ ...payload, back: html })}
                            placeholder="Back of the card…"
                            minHeight={60}
                        />
                    </div>
                </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-caption text-neutral-600">
                Aspect ratio:
                {(['original', '1:1', '4:3', '16:9'] as const).map((r) => (
                    <button
                        key={r}
                        type="button"
                        className={cn(
                            'rounded-md border border-neutral-200 px-2 py-0.5',
                            payload.aspectRatio === r && 'border-primary-400 text-primary-500'
                        )}
                        onClick={() => setPayload({ ...payload, aspectRatio: r })}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </BlockShell>
    );
}

// ---------- Tabs ----------
export function TabsBlockEditor({ payload, setPayload, readOnly }: BlockEditorProps<TabsPayload>) {
    const [active, setActive] = useState(0);
    const tabs = payload.tabs;
    const activeTab = tabs[Math.min(active, tabs.length - 1)];

    return (
        <BlockShell
            title="Tabbed content"
            actions={
                !readOnly ? (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() => {
                            setPayload({
                                tabs: [...tabs, { label: `Tab ${tabs.length + 1}`, content: '' }],
                            });
                            setActive(tabs.length);
                        }}
                    >
                        <Plus size={14} className="mr-1" /> Add tab
                    </MyButton>
                ) : undefined
            }
        >
            <div className="mb-2 flex flex-wrap gap-1 border-b border-neutral-200">
                {tabs.map((t, i) => (
                    <button
                        key={i}
                        type="button"
                        className={cn(
                            'rounded-t-md px-3 py-1.5 text-caption font-medium',
                            i === active
                                ? 'border-b-2 border-primary-500 text-primary-500'
                                : 'text-neutral-500'
                        )}
                        onClick={() => setActive(i)}
                    >
                        {t.label || `Tab ${i + 1}`}
                    </button>
                ))}
            </div>
            {activeTab && (
                <div>
                    {!readOnly && (
                        <div className="mb-2 flex items-center gap-2">
                            <MyInput
                                inputType="text"
                                inputPlaceholder="Tab label"
                                input={activeTab.label}
                                onChangeFunction={(e) =>
                                    setPayload({
                                        tabs: tabs.map((t, i) =>
                                            i === active ? { ...t, label: e.target.value } : t
                                        ),
                                    })
                                }
                                size="small"
                            />
                            {tabs.length > 1 && (
                                <MyButton
                                    buttonType="text"
                                    scale="small"
                                    onClick={() => {
                                        setPayload({ tabs: tabs.filter((_, i) => i !== active) });
                                        setActive(Math.max(0, active - 1));
                                    }}
                                >
                                    <Trash size={14} />
                                </MyButton>
                            )}
                        </div>
                    )}
                    {readOnly ? (
                        <RichTextHtml html={activeTab.content} />
                    ) : (
                        <div className="rounded-md border border-neutral-200 bg-white p-2">
                            <RichTextField
                                value={activeTab.content}
                                onChange={(html) =>
                                    setPayload({
                                        tabs: tabs.map((t, i) =>
                                            i === active ? { ...t, content: html } : t
                                        ),
                                    })
                                }
                                placeholder="Tab content…"
                                minHeight={80}
                            />
                        </div>
                    )}
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Quiz ----------
export function QuizBlockEditor({ payload, setPayload, readOnly }: BlockEditorProps<QuizPayload>) {
    const letters = 'ABCDEFGHIJ';

    const setType = (type: QuizPayload['type']) => {
        if (type === payload.type) return;
        if (type === 'trueFalse') {
            setPayload({
                ...payload,
                type,
                options: [
                    { text: 'True', isCorrect: true },
                    { text: 'False', isCorrect: false },
                ],
            });
        } else {
            setPayload({ ...payload, type });
        }
    };

    return (
        <BlockShell
            title="Quiz"
            actions={
                !readOnly ? (
                    <div className="flex gap-1">
                        {(['mcq', 'trueFalse'] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                className={cn(
                                    'rounded-md border border-neutral-200 px-2 py-0.5 text-caption',
                                    payload.type === t && 'border-primary-400 text-primary-500'
                                )}
                                onClick={() => setType(t)}
                            >
                                {t === 'mcq' ? 'MCQ' : 'True/False'}
                            </button>
                        ))}
                    </div>
                ) : undefined
            }
        >
            {readOnly ? (
                <RichTextHtml html={payload.question} />
            ) : (
                <div className="mb-2 rounded-md border border-neutral-200 bg-white p-2">
                    <RichTextField
                        value={payload.question}
                        onChange={(html) => setPayload({ ...payload, question: html })}
                        placeholder="Question…"
                        minHeight={40}
                    />
                </div>
            )}
            {payload.options.map((opt, i) => (
                <div
                    key={i}
                    className={cn(
                        'mb-1 flex items-start gap-2 rounded-md border bg-white p-2',
                        opt.isCorrect ? 'border-success-400' : 'border-neutral-200'
                    )}
                >
                    <input
                        type="radio"
                        name="correct-option"
                        className="mt-1.5"
                        checked={opt.isCorrect}
                        disabled={readOnly}
                        onChange={() =>
                            setPayload({
                                ...payload,
                                options: payload.options.map((o, j) => ({
                                    ...o,
                                    isCorrect: j === i,
                                })),
                            })
                        }
                    />
                    <span className="mt-1 text-caption font-semibold text-primary-500">
                        {letters[i]}.
                    </span>
                    <div className="grow">
                        {readOnly || payload.type === 'trueFalse' ? (
                            <RichTextHtml html={opt.text} />
                        ) : (
                            <RichTextField
                                value={opt.text}
                                onChange={(html) =>
                                    setPayload({
                                        ...payload,
                                        options: payload.options.map((o, j) =>
                                            j === i ? { ...o, text: html } : o
                                        ),
                                    })
                                }
                                placeholder={`Option ${letters[i]}…`}
                                minHeight={24}
                            />
                        )}
                    </div>
                    {!readOnly && payload.type === 'mcq' && payload.options.length > 2 && (
                        <MyButton
                            buttonType="text"
                            scale="small"
                            onClick={() =>
                                setPayload({
                                    ...payload,
                                    options: payload.options.filter((_, j) => j !== i),
                                })
                            }
                        >
                            <Trash size={14} />
                        </MyButton>
                    )}
                </div>
            ))}
            {!readOnly && payload.type === 'mcq' && payload.options.length < 10 && (
                <MyButton
                    buttonType="text"
                    scale="small"
                    onClick={() =>
                        setPayload({
                            ...payload,
                            options: [...payload.options, { text: '', isCorrect: false }],
                        })
                    }
                >
                    <Plus size={14} className="mr-1" /> Add option
                </MyButton>
            )}
            {!readOnly && (
                <div className="mt-2">
                    <div className="mb-1 text-caption text-neutral-500">
                        Explanation (shown after answering)
                    </div>
                    <div className="rounded-md border border-neutral-200 bg-white p-2">
                        <RichTextField
                            value={payload.explanation}
                            onChange={(html) => setPayload({ ...payload, explanation: html })}
                            placeholder="Why is this the correct answer?"
                            minHeight={32}
                        />
                    </div>
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Timeline ----------
export function TimelineBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<TimelinePayload>) {
    return (
        <BlockShell
            title="Timeline"
            actions={
                !readOnly ? (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() =>
                            setPayload({
                                steps: [
                                    ...payload.steps,
                                    {
                                        title: `Step ${payload.steps.length + 1}`,
                                        description: '',
                                        color: '#007acc', // design-lint-ignore: serialized learner HTML needs literal colours
                                    },
                                ],
                            })
                        }
                    >
                        <Plus size={14} className="mr-1" /> Add step
                    </MyButton>
                ) : undefined
            }
        >
            <div className="border-l-2 border-neutral-200 pl-4">
                {payload.steps.map((step, i) => (
                    <div key={i} className="relative mb-3">
                        <span
                            className="absolute -left-6 top-1.5 size-3 rounded-full"
                            style={{ background: step.color }}
                        />
                        {readOnly ? (
                            <>
                                <div className="font-semibold text-neutral-700">{step.title}</div>
                                {step.description && (
                                    <div className="text-caption text-neutral-500">
                                        {step.description}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-start gap-2">
                                <div className="flex grow flex-col gap-1">
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Step title"
                                        input={step.title}
                                        onChangeFunction={(e) =>
                                            setPayload({
                                                steps: payload.steps.map((s, j) =>
                                                    j === i ? { ...s, title: e.target.value } : s
                                                ),
                                            })
                                        }
                                        size="small"
                                    />
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Description (optional)"
                                        input={step.description}
                                        onChangeFunction={(e) =>
                                            setPayload({
                                                steps: payload.steps.map((s, j) =>
                                                    j === i
                                                        ? { ...s, description: e.target.value }
                                                        : s
                                                ),
                                            })
                                        }
                                        size="small"
                                    />
                                </div>
                                <input
                                    type="color"
                                    aria-label="Step color"
                                    value={step.color}
                                    className="mt-1 size-6 cursor-pointer rounded border-none"
                                    onChange={(e) =>
                                        setPayload({
                                            steps: payload.steps.map((s, j) =>
                                                j === i ? { ...s, color: e.target.value } : s
                                            ),
                                        })
                                    }
                                />
                                {payload.steps.length > 1 && (
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        onClick={() =>
                                            setPayload({
                                                steps: payload.steps.filter((_, j) => j !== i),
                                            })
                                        }
                                    >
                                        <Trash size={14} />
                                    </MyButton>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </BlockShell>
    );
}

// ---------- Columns ----------
export function ColumnsBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<ColumnsPayload>) {
    return (
        <BlockShell
            title={`Columns (${payload.columns.length})`}
            actions={
                !readOnly ? (
                    <div className="flex items-center gap-1">
                        {payload.columns.length < 4 && (
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() =>
                                    setPayload({
                                        ...payload,
                                        columns: [...payload.columns, { content: '' }],
                                    })
                                }
                            >
                                <Plus size={14} className="mr-1" /> Add column
                            </MyButton>
                        )}
                        {payload.columns.length > 1 && (
                            <MyButton
                                buttonType="text"
                                scale="small"
                                onClick={() =>
                                    setPayload({
                                        ...payload,
                                        columns: payload.columns.slice(0, -1),
                                    })
                                }
                            >
                                <Trash size={14} className="mr-1" /> Remove last
                            </MyButton>
                        )}
                    </div>
                ) : undefined
            }
        >
            <div
                className="grid"
                style={{
                    gridTemplateColumns: `repeat(${payload.columns.length}, 1fr)`,
                    gap: payload.gap,
                }}
            >
                {payload.columns.map((col, i) => (
                    <div key={i} className="rounded-md border border-neutral-200 bg-white p-2">
                        {readOnly ? (
                            <RichTextHtml html={col.content} />
                        ) : (
                            <RichTextField
                                value={col.content}
                                onChange={(html) =>
                                    setPayload({
                                        ...payload,
                                        columns: payload.columns.map((c, j) =>
                                            j === i ? { content: html } : c
                                        ),
                                    })
                                }
                                placeholder={`Column ${i + 1}…`}
                                minHeight={60}
                            />
                        )}
                    </div>
                ))}
            </div>
        </BlockShell>
    );
}

// ---------- Accordion ----------
export function AccordionBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<AccordionPayload>) {
    const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([0]));

    const toggle = (i: number) => {
        setOpenSet((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };

    return (
        <BlockShell
            title="Accordion"
            actions={
                !readOnly ? (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() => {
                            setPayload({
                                items: [
                                    ...payload.items,
                                    { heading: `Section ${payload.items.length + 1}`, content: '' },
                                ],
                            });
                            setOpenSet((prev) => new Set(prev).add(payload.items.length));
                        }}
                    >
                        <Plus size={14} className="mr-1" /> Add section
                    </MyButton>
                ) : undefined
            }
        >
            {payload.items.map((item, i) => {
                const open = openSet.has(i);
                return (
                    <div key={i} className="mb-1 rounded-md border border-neutral-200 bg-white">
                        <div className="flex items-center gap-2 p-2">
                            <button
                                type="button"
                                onClick={() => toggle(i)}
                                aria-label="Toggle section"
                            >
                                {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
                            </button>
                            {readOnly ? (
                                <span className="font-medium text-neutral-700">{item.heading}</span>
                            ) : (
                                <>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Section heading"
                                        input={item.heading}
                                        onChangeFunction={(e) =>
                                            setPayload({
                                                items: payload.items.map((it, j) =>
                                                    j === i
                                                        ? { ...it, heading: e.target.value }
                                                        : it
                                                ),
                                            })
                                        }
                                        size="small"
                                    />
                                    {payload.items.length > 1 && (
                                        <MyButton
                                            buttonType="text"
                                            scale="small"
                                            onClick={() =>
                                                setPayload({
                                                    items: payload.items.filter((_, j) => j !== i),
                                                })
                                            }
                                        >
                                            <Trash size={14} />
                                        </MyButton>
                                    )}
                                </>
                            )}
                        </div>
                        {open && (
                            <div className="border-t border-neutral-100 p-2">
                                {readOnly ? (
                                    <RichTextHtml html={item.content} />
                                ) : (
                                    <RichTextField
                                        value={item.content}
                                        onChange={(html) =>
                                            setPayload({
                                                items: payload.items.map((it, j) =>
                                                    j === i ? { ...it, content: html } : it
                                                ),
                                            })
                                        }
                                        placeholder="Section content…"
                                        minHeight={48}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </BlockShell>
    );
}

// ---------- Code (generic) ----------
const CODE_LANGUAGES = [
    'javascript',
    'typescript',
    'python',
    'java',
    'c',
    'cpp',
    'csharp',
    'go',
    'rust',
    'html',
    'css',
    'sql',
    'bash',
    'json',
    'yaml',
];

export function CodeBlockEditor({ payload, setPayload, readOnly }: BlockEditorProps<CodePayload>) {
    return (
        <div className="my-2 overflow-hidden rounded-md">
            {!readOnly && (
                <div className="flex items-center gap-2 bg-neutral-700 px-3 py-1">
                    <select
                        aria-label="Code language"
                        className="rounded-sm bg-neutral-600 px-1 py-0.5 text-caption text-white"
                        value={payload.language}
                        onChange={(e) => setPayload({ ...payload, language: e.target.value })}
                    >
                        {CODE_LANGUAGES.map((l) => (
                            <option key={l} value={l}>
                                {l}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <textarea
                className="block w-full resize-y bg-neutral-800 p-4 font-mono text-caption text-white outline-none"
                rows={Math.max(3, payload.code.split('\n').length)}
                spellCheck={false}
                readOnly={readOnly}
                placeholder="// code"
                value={payload.code}
                onChange={(e) => setPayload({ ...payload, code: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
            />
        </div>
    );
}

// ---------- Multi-language runnable code ----------
export function MultiLangCodeBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<MultiLangCodePayload>) {
    return (
        <BlockShell title={`${payload.language.toUpperCase()} Code Editor`}>
            {!readOnly && (
                <div className="mb-2">
                    <select
                        aria-label="Language"
                        className="rounded-md border border-neutral-200 px-2 py-1 text-caption"
                        value={payload.language}
                        onChange={(e) => setPayload({ ...payload, language: e.target.value })}
                    >
                        {['python', 'javascript', 'html', 'css'].map((l) => (
                            <option key={l} value={l}>
                                {l}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <textarea
                className="block w-full resize-y rounded-md bg-neutral-800 p-4 font-mono text-caption text-white outline-none"
                rows={Math.max(4, payload.code.split('\n').length)}
                spellCheck={false}
                readOnly={readOnly}
                placeholder={`# ${payload.language} code — learners get an interactive runner`}
                value={payload.code}
                onChange={(e) => setPayload({ ...payload, code: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
            />
            {payload.output && (
                <div className="mt-2 text-caption text-neutral-500">
                    Output:
                    <pre className="mt-1 whitespace-pre-wrap rounded-md bg-neutral-100 p-2">
                        {payload.output}
                    </pre>
                </div>
            )}
        </BlockShell>
    );
}
