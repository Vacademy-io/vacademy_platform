import { useState, useEffect, useRef } from 'react';
import { YooptaPlugin, useYooptaEditor, Elements, PluginElementRenderProps } from '@yoopta/editor';

interface ColumnData {
    content: string;
}

const COLUMN_PRESETS = [
    { label: '2 Columns', count: 2 },
    { label: '3 Columns', count: 3 },
    { label: '4 Columns', count: 4 },
];

export function ColumnsBlock({ element, attributes, children, blockId }: PluginElementRenderProps) {
    const editor = useYooptaEditor();
    const [columns, setColumns] = useState<ColumnData[]>(
        element?.props?.columns || [{ content: '' }, { content: '' }]
    );
    const [gap, setGap] = useState<number>(element?.props?.gap ?? 16);
    const [isEditing, setIsEditing] = useState(!element?.props?.columns?.length);
    const isFirstRender = useRef(true);

    // Persist state to Yoopta/Slate store
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        Elements.updateElement(editor, blockId, {
            type: 'columnsLayout',
            props: {
                ...element.props,
                columns,
                columnCount: columns.length,
                gap,
                editorType: 'columnsEditor',
            },
        });
    }, [columns, gap]);

    const setColumnCount = (count: number) => {
        setColumns((prev) => {
            if (count > prev.length) {
                // Add columns
                return [...prev, ...Array.from({ length: count - prev.length }, () => ({ content: '' }))];
            }
            // Remove columns from the end
            return prev.slice(0, count);
        });
    };

    const updateColumnContent = (index: number, content: string) => {
        setColumns((prev) =>
            prev.map((col, i) => (i === index ? { ...col, content } : col))
        );
    };

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
                    Columns Layout
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Column count */}
                    {COLUMN_PRESETS.map((preset) => (
                        <button
                            key={preset.count}
                            onClick={() => setColumnCount(preset.count)}
                            style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: columns.length === preset.count ? '#007acc' : 'white',
                                color: columns.length === preset.count ? 'white' : '#666',
                                cursor: 'pointer',
                            }}
                        >
                            {preset.count}
                        </button>
                    ))}

                    {/* Gap control */}
                    <select
                        value={gap}
                        onChange={(e) => setGap(Number(e.target.value))}
                        style={{ fontSize: '11px', padding: '3px 4px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        <option value={8}>Tight</option>
                        <option value={16}>Normal</option>
                        <option value={24}>Wide</option>
                        <option value={32}>Extra Wide</option>
                    </select>

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

            {/* Content */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
                    gap: `${gap}px`,
                    padding: '12px',
                }}
            >
                {columns.map((col, index) => (
                    <div
                        key={index}
                        style={{
                            border: isEditing ? '1px dashed #ccc' : '1px solid transparent',
                            borderRadius: '4px',
                            minHeight: isEditing ? '80px' : '20px',
                            position: 'relative',
                        }}
                    >
                        {isEditing && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '4px',
                                    left: '8px',
                                    fontSize: '10px',
                                    color: '#999',
                                    fontWeight: 600,
                                }}
                            >
                                Column {index + 1}
                            </div>
                        )}
                        {isEditing ? (
                            <textarea
                                value={col.content}
                                onChange={(e) => updateColumnContent(index, e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder={`Column ${index + 1} content...`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    minHeight: '80px',
                                    padding: '20px 8px 8px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                    backgroundColor: '#fff',
                                    outline: 'none',
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    padding: '8px',
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                    color: '#333',
                                    whiteSpace: 'pre-wrap',
                                }}
                            >
                                {col.content || (
                                    <span style={{ color: '#ccc', fontStyle: 'italic' }}>
                                        Empty column
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {children}
        </div>
    );
}

// Columns icon
const ColumnsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
);

// Yoopta Plugin Definition
export const ColumnsPlugin = new YooptaPlugin<{ columnsLayout: any }>({
    type: 'columnsLayout',
    elements: {
        columnsLayout: {
            render: ColumnsBlock,
        },
    },
    options: {
        display: {
            title: 'Columns Layout',
            description: 'Add multi-column text layout',
            icon: <ColumnsIcon />,
        },
        shortcuts: ['columns', 'cols', 'grid', 'layout'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    if (element.getAttribute?.('data-yoopta-type') !== 'columnsLayout') {
                        return undefined;
                    }
                    let columns: ColumnData[] = [];
                    const gap = parseInt(element.getAttribute('data-gap') || '16', 10);
                    try {
                        const columnsJson = element.getAttribute('data-columns');
                        if (columnsJson) {
                            columns = JSON.parse(columnsJson);
                        }
                    } catch {
                        columns = [{ content: '' }, { content: '' }];
                    }
                    return {
                        id: `cols-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'columnsLayout',
                        props: { columns, columnCount: columns.length, gap, editorType: 'columnsEditor' },
                        children: [{ text: '' }],
                    };
                },
            },
            serialize: (element, _children) => {
                const props = element.props || {};
                const columns: ColumnData[] = props.columns || [];
                const gap = props.gap ?? 16;
                const columnsJson = JSON.stringify(columns).replace(/"/g, '&quot;');

                const columnDivs = columns
                    .map((col) => {
                        const contentEsc = col.content
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\n/g, '<br/>');
                        return `<div style="padding: 8px; font-size: 14px; line-height: 1.6; color: #333;">${contentEsc}</div>`;
                    })
                    .join('');

                return `<div data-yoopta-type="columnsLayout" data-editor-type="columnsEditor" data-columns="${columnsJson}" data-gap="${gap}" style="display: grid; grid-template-columns: repeat(${columns.length}, 1fr); gap: ${gap}px; padding: 12px; margin: 8px 0; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa;">${columnDivs}</div>`;
            },
        },
    },
});
