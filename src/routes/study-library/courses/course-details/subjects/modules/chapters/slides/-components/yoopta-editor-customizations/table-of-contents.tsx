import { useState, useEffect, useCallback, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';

interface TocItem {
    blockId: string;
    level: 1 | 2 | 3;
    text: string;
    order: number;
}

const HEADING_TYPES: Record<string, 1 | 2 | 3> = {
    'heading-one': 1,
    'heading-two': 2,
    'heading-three': 3,
};

function extractHeadings(editorChildren: Record<string, any>): TocItem[] {
    if (!editorChildren || typeof editorChildren !== 'object') return [];

    return Object.values(editorChildren)
        .filter((block: any) => block?.type in HEADING_TYPES)
        .map((block: any) => {
            const level = HEADING_TYPES[block.type]!;
            let text = '';
            const el = block.value?.[0];
            if (el?.children && Array.isArray(el.children)) {
                text = el.children.map((node: any) => node.text || '').join('');
            }
            return {
                blockId: block.id,
                level,
                text: text.trim(),
                order: block.meta?.order ?? 0,
            };
        })
        .filter((item) => item.text.length > 0)
        .sort((a, b) => a.order - b.order);
}

export function TableOfContentsBlock({
    element,
    attributes,
    children,
    blockId,
}: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const [headings, setHeadings] = useState<TocItem[]>([]);
    const isFirstRender = useRef(true);

    const refreshHeadings = useCallback(() => {
        const items = extractHeadings(editor.children);
        setHeadings(items);
    }, [editor]);

    // Initial scan + listen for changes
    useEffect(() => {
        refreshHeadings();

        const handleChange = () => {
            refreshHeadings();
        };

        editor.on('change', handleChange);
        return () => {
            editor.off('change', handleChange);
        };
    }, [editor, refreshHeadings]);

    // Persist to Yoopta store
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'tableOfContents',
            props: {
                ...element.props,
                editorType: 'tocEditor',
            },
        });
    }, []);

    const scrollToBlock = (targetBlockId: string) => {
        // Try to find the block's DOM element and scroll to it
        const blockEl = document.querySelector(`[data-yoopta-block-id="${targetBlockId}"]`);
        if (blockEl) {
            blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Focus the block
            try {
                (editor as any).focusBlock?.(targetBlockId);
            } catch {
                // focusBlock may not exist in all versions
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>
                        <TocIcon />
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                        Table of Contents
                    </span>
                </div>
                <button
                    onClick={refreshHeadings}
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
                    Refresh
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '12px 16px' }}>
                {headings.length === 0 ? (
                    <div
                        style={{
                            padding: '16px',
                            textAlign: 'center',
                            color: '#999',
                            fontSize: '14px',
                        }}
                    >
                        No headings found. Add Heading 1, 2, or 3 blocks to generate an outline.
                    </div>
                ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {headings.map((item) => (
                            <li
                                key={item.blockId}
                                onClick={() => scrollToBlock(item.blockId)}
                                style={{
                                    paddingLeft: `${(item.level - 1) * 20}px`,
                                    padding: `4px 8px 4px ${(item.level - 1) * 20 + 8}px`,
                                    fontSize: item.level === 1 ? '15px' : item.level === 2 ? '14px' : '13px',
                                    fontWeight: item.level === 1 ? 600 : 400,
                                    color: '#007acc',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.15s',
                                    lineHeight: 1.8,
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.backgroundColor = '#e8f4fd';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                            >
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: '20px',
                                        color: '#999',
                                        fontSize: '11px',
                                    }}
                                >
                                    {item.level === 1 ? 'H1' : item.level === 2 ? 'H2' : 'H3'}
                                </span>
                                {item.text}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {children}
        </div>
    );
}

// TOC Icon
const TocIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="7" y1="12" x2="21" y2="12" />
        <line x1="7" y1="18" x2="21" y2="18" />
        <circle cx="3" cy="12" r="1" fill="currentColor" />
        <circle cx="3" cy="18" r="1" fill="currentColor" />
    </svg>
);

// Yoopta Plugin Definition
export const TableOfContentsPlugin = new YooptaPlugin<{ tableOfContents: any }>({
    type: 'tableOfContents',
    elements: {
        tableOfContents: {
            render: TableOfContentsBlock,
        },
    },
    options: {
        display: {
            title: 'Table of Contents',
            description: 'Auto-generated outline from headings',
            icon: <TocIcon />,
        },
        shortcuts: ['toc', 'outline', 'contents'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'tableOfContents') {
                        return undefined;
                    }
                    return {
                        id: `toc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'tableOfContents',
                        props: { editorType: 'tocEditor' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                // Generate a static TOC for the serialized HTML
                // Since we can't access editor.children from the serializer,
                // we output a placeholder that the learner side can style
                return `<div data-yoopta-type="tableOfContents" data-editor-type="tocEditor" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 8px 0; background: #fafafa;"><div style="font-weight: 600; font-size: 15px; color: #333; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">Table of Contents</div><div style="color: #666; font-size: 13px;">Outline is auto-generated from document headings.</div></div>`;
            },
        },
    },
});
