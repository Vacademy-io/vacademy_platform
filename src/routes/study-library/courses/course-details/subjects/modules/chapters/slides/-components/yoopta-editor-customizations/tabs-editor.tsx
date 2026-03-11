import { useState, useEffect, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';

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
    const [tabs, setTabs] = useState<TabItem[]>(
        element?.props?.tabs || DEFAULT_TABS.map((t) => ({ ...t }))
    );
    const [activeTab, setActiveTab] = useState(0);
    const [isEditing, setIsEditing] = useState(!element?.props?.tabs?.length);
    const isFirstRender = useRef(true);

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

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement | HTMLInputElement;
            if (target.value.length > 0 || target.selectionStart !== 0) {
                e.stopPropagation();
            }
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
    };

    const removeTab = (index: number) => {
        if (tabs.length <= 1) return;
        setTabs((prev) => prev.filter((_, i) => i !== index));
        if (activeTab >= tabs.length - 1) {
            setActiveTab(Math.max(0, tabs.length - 2));
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
                                color: '#666',
                                cursor: 'pointer',
                            }}
                        >
                            + Add Tab
                        </button>
                    )}
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
            </div>

            {/* Tab Bar */}
            <div
                style={{
                    display: 'flex',
                    borderBottom: '1px solid #e0e0e0',
                    backgroundColor: '#fff',
                    overflowX: 'auto',
                }}
            >
                {tabs.map((tab, index) => (
                    <div
                        key={index}
                        onClick={() => setActiveTab(index)}
                        style={{
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: activeTab === index ? 600 : 400,
                            color: activeTab === index ? '#007acc' : '#666',
                            borderBottom: activeTab === index ? '2px solid #007acc' : '2px solid transparent',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                    >
                        {isEditing ? (
                            <input
                                value={tab.label}
                                onChange={(e) => updateTabLabel(index, e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    border: 'none',
                                    borderBottom: '1px dashed #ccc',
                                    background: 'transparent',
                                    fontSize: '13px',
                                    fontWeight: activeTab === index ? 600 : 400,
                                    color: activeTab === index ? '#007acc' : '#666',
                                    outline: 'none',
                                    width: `${Math.max(tab.label.length * 8, 50)}px`,
                                    padding: '0',
                                }}
                            />
                        ) : (
                            tab.label
                        )}
                        {isEditing && tabs.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTab(index);
                                }}
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    border: 'none',
                                    background: 'none',
                                    color: '#999',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    lineHeight: '14px',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                title="Remove tab"
                            >
                                x
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '12px', minHeight: '80px' }}>
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

            {children}
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
