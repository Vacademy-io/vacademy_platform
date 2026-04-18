import { useState, useEffect, useRef } from 'react';
import {
    YooptaPlugin,
    useYooptaEditor,
    useYooptaReadOnly,
    Elements,
    PluginElementRenderProps,
} from '@yoopta/editor';

interface TabItem {
    label: string;
    content: string;
}

const DEFAULT_TABS: TabItem[] = [
    { label: 'Tab 1', content: '' },
    { label: 'Tab 2', content: '' },
];

export function TabsBlock({
    element,
    attributes,
    children,
    blockId,
}: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const isReadOnly = useYooptaReadOnly();
    const [tabs, setTabs] = useState<TabItem[]>(
        element?.props?.tabs || DEFAULT_TABS.map((t) => ({ ...t }))
    );
    const [activeTab, setActiveTab] = useState(0);
    // In read-only mode (learner view) we never enter Edit mode — learners
    // only switch between tabs and read content, never rename labels or
    // toggle chrome. Force preview regardless of the default-on-empty check.
    const [isEditing, setIsEditing] = useState(
        !isReadOnly && !element?.props?.tabs?.length
    );
    const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
    const isFirstRender = useRef(true);
    const renameInputRef = useRef<HTMLInputElement | null>(null);

    // Persist state
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'tabbedContent',
            props: {
                ...element.props,
                tabs,
                editorType: 'tabsEditor',
            },
        });
    }, [tabs]);

    // Autofocus the rename input when it appears
    useEffect(() => {
        if (renamingIndex !== null && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingIndex]);

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement | HTMLInputElement;
            if (target.value.length > 0 || target.selectionStart !== 0) {
                e.stopPropagation();
            }
        }
        if (e.key === 'Enter' && renamingIndex !== null) {
            e.preventDefault();
            setRenamingIndex(null);
        }
        if (e.key === 'Escape' && renamingIndex !== null) {
            e.preventDefault();
            setRenamingIndex(null);
        }
    };

    const updateTabLabel = (index: number, label: string) => {
        setTabs((prev) => prev.map((t, i) => (i === index ? { ...t, label } : t)));
    };

    const updateTabContent = (index: number, content: string) => {
        setTabs((prev) => prev.map((t, i) => (i === index ? { ...t, content } : t)));
    };

    const addTab = () => {
        setTabs((prev) => [...prev, { label: `Tab ${prev.length + 1}`, content: '' }]);
        setActiveTab(tabs.length);
    };

    const removeTab = (index: number) => {
        if (tabs.length <= 1) return;
        setTabs((prev) => prev.filter((_, i) => i !== index));
        if (activeTab >= tabs.length - 1) {
            setActiveTab(Math.max(0, tabs.length - 2));
        }
        if (renamingIndex === index) setRenamingIndex(null);
    };

    const ACTIVE_COLOR = '#007acc';
    const BORDER_COLOR = '#e0e0e0';
    const MUTED_COLOR = '#666';

    return (
        <div
            {...attributes}
            contentEditable={false}
            style={{
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '8px',
                margin: '8px 0',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
            }}
        >
            {/* Header — admin chrome only. Hidden on learner (read-only)
                views so students just see the clean tabs + content. */}
            {!isReadOnly && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#f0f0f0',
                        borderBottom: `1px solid ${BORDER_COLOR}`,
                    }}
                >
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                        Tabbed Content
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {isEditing && (
                            <button
                                onClick={addTab}
                                style={{
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    backgroundColor: 'white',
                                    color: MUTED_COLOR,
                                    cursor: 'pointer',
                                }}
                            >
                                + Add Tab
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsEditing(!isEditing);
                                setRenamingIndex(null);
                            }}
                            style={{
                                padding: '3px 10px',
                                fontSize: '12px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: 'white',
                                color: MUTED_COLOR,
                                cursor: 'pointer',
                            }}
                        >
                            {isEditing ? 'Preview' : 'Edit'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Bar
                UX notes:
                - Whole button is a click target → switches active tab
                - Active tab: white background, blue top border, bold label
                - Inactive: gray background, hover highlight
                - Double-click label to rename (edit mode only)
                - Pencil icon + x are separate buttons that stop propagation */}
            <div
                style={{
                    display: 'flex',
                    gap: '2px',
                    padding: '4px 4px 0 4px',
                    backgroundColor: '#f5f5f5',
                    borderBottom: `1px solid ${BORDER_COLOR}`,
                    overflowX: 'auto',
                }}
            >
                {tabs.map((tab, index) => {
                    const isActive = activeTab === index;
                    const isRenaming = renamingIndex === index;
                    return (
                        <button
                            key={index}
                            type="button"
                            onClick={() => {
                                if (!isRenaming) setActiveTab(index);
                            }}
                            onDoubleClick={() => {
                                if (isEditing) setRenamingIndex(index);
                            }}
                            title={isEditing && !isRenaming ? 'Click to switch · Double-click to rename' : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                fontSize: '13px',
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? ACTIVE_COLOR : MUTED_COLOR,
                                backgroundColor: isActive ? '#ffffff' : 'transparent',
                                border: 'none',
                                borderTop: `2px solid ${isActive ? ACTIVE_COLOR : 'transparent'}`,
                                borderLeft: `1px solid ${isActive ? BORDER_COLOR : 'transparent'}`,
                                borderRight: `1px solid ${isActive ? BORDER_COLOR : 'transparent'}`,
                                borderTopLeftRadius: '6px',
                                borderTopRightRadius: '6px',
                                marginBottom: '-1px',
                                cursor: isRenaming ? 'text' : 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'background-color 0.15s, color 0.15s',
                                outline: 'none',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive && !isRenaming) {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                        '#ebebeb';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive && !isRenaming) {
                                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                        'transparent';
                                }
                            }}
                        >
                            {isRenaming ? (
                                <input
                                    ref={renameInputRef}
                                    value={tab.label}
                                    onChange={(e) => updateTabLabel(index, e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                    onBlur={() => setRenamingIndex(null)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        border: `1px solid ${ACTIVE_COLOR}`,
                                        borderRadius: '3px',
                                        background: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: ACTIVE_COLOR,
                                        outline: 'none',
                                        padding: '2px 6px',
                                        minWidth: '60px',
                                        width: `${Math.max(tab.label.length * 8, 60)}px`,
                                    }}
                                />
                            ) : (
                                <span style={{ userSelect: 'none' }}>{tab.label || 'Untitled'}</span>
                            )}
                            {isEditing && !isRenaming && (
                                <span
                                    role="button"
                                    aria-label="Rename tab"
                                    title="Rename tab"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRenamingIndex(index);
                                    }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '16px',
                                        height: '16px',
                                        color: isActive ? ACTIVE_COLOR : '#999',
                                        cursor: 'pointer',
                                        opacity: 0.75,
                                    }}
                                >
                                    <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                </span>
                            )}
                            {isEditing && tabs.length > 1 && !isRenaming && (
                                <span
                                    role="button"
                                    aria-label="Remove tab"
                                    title="Remove tab"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTab(index);
                                    }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        color: '#999',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        lineHeight: '13px',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLSpanElement).style.backgroundColor =
                                            '#e0e0e0';
                                        (e.currentTarget as HTMLSpanElement).style.color = '#333';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLSpanElement).style.backgroundColor =
                                            'transparent';
                                        (e.currentTarget as HTMLSpanElement).style.color = '#999';
                                    }}
                                >
                                    ×
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '12px', minHeight: '80px', backgroundColor: '#fff' }}>
                {isEditing ? (
                    <textarea
                        value={tabs[activeTab]?.content || ''}
                        onChange={(e) => updateTabContent(activeTab, e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder={`Content for "${tabs[activeTab]?.label || 'Tab'}"...`}
                        style={{
                            width: '100%',
                            minHeight: '100px',
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
                ) : (
                    <div
                        style={{
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: '#333',
                            whiteSpace: 'pre-wrap',
                            padding: '8px',
                        }}
                    >
                        {tabs[activeTab]?.content || (
                            <span style={{ color: '#ccc', fontStyle: 'italic' }}>
                                Empty tab content
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Slate requires {children} to be rendered for the block to be
                valid, but we don't want the default paragraph placeholder
                ("Type / for commands") visible — it was overlaying the tab
                content area. Hide it visually while keeping it in the DOM. */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    overflow: 'hidden',
                    opacity: 0,
                    pointerEvents: 'none',
                }}
            >
                {children}
            </div>
        </div>
    );
}

// Tabs Icon
const TabsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M2 6h6V3h4v3" />
    </svg>
);

// Yoopta Plugin Definition
export const TabsPlugin = new YooptaPlugin<{ tabbedContent: any }>({
    type: 'tabbedContent',
    elements: {
        tabbedContent: {
            render: TabsBlock,
        },
    },
    options: {
        display: {
            title: 'Tabbed Content',
            description: 'Organize content in switchable tabs',
            icon: <TabsIcon />,
        },
        shortcuts: ['tabs', 'tabbed'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'tabbedContent') {
                        return undefined;
                    }
                    let tabs: TabItem[] = [];
                    try {
                        const tabsJson = element.getAttribute('data-tabs');
                        if (tabsJson) {
                            tabs = JSON.parse(tabsJson);
                        }
                    } catch {
                        tabs = DEFAULT_TABS.map((t) => ({ ...t }));
                    }
                    return {
                        id: `tabs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'tabbedContent',
                        props: { tabs, editorType: 'tabsEditor' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                const props = element.props || {};
                const tabs: TabItem[] = props.tabs || [];
                const tabsJson = JSON.stringify(tabs).replace(/"/g, '&quot;');

                const tabHeaders = tabs
                    .map(
                        (tab, i) =>
                            `<div style="padding: 8px 16px; font-size: 13px; font-weight: ${i === 0 ? 600 : 400}; color: ${i === 0 ? '#007acc' : '#666'}; border-bottom: 2px solid ${i === 0 ? '#007acc' : 'transparent'}; cursor: pointer;">${tab.label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
                    )
                    .join('');

                const tabContents = tabs
                    .map((tab, i) => {
                        const contentEsc = tab.content
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\n/g, '<br/>');
                        return `<div data-tab-index="${i}" style="display: ${i === 0 ? 'block' : 'none'}; padding: 12px; font-size: 14px; line-height: 1.6; color: #333;">${contentEsc}</div>`;
                    })
                    .join('');

                return `<div data-yoopta-type="tabbedContent" data-editor-type="tabsEditor" data-tabs="${tabsJson}" style="border: 1px solid #e0e0e0; border-radius: 8px; margin: 8px 0; overflow: hidden; background: #fafafa;"><div style="display: flex; border-bottom: 1px solid #e0e0e0; background: #fff;">${tabHeaders}</div><div>${tabContents}</div></div>`;
            },
        },
    },
});
