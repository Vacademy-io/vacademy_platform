import { useEffect } from 'react';
import YooptaEditor from '@yoopta/editor';
import type { YooEditor } from '@yoopta/editor';

interface YooptaEditorWrapperProps {
    editor: YooEditor;
    plugins: any[];
    tools: any;
    marks: any;
    value: any;
    selectionBoxRoot: React.RefObject<HTMLDivElement>;
    autoFocus: boolean;
    onChange: () => void;
    className?: string;
    style?: React.CSSProperties;
    readOnly?: boolean;
    // Called once after <YooptaEditor> has mounted. By this point YooptaEditor
    // has built the proper plugin/block/format maps on the shared editor
    // instance, so callers can safely (re-)deserialize content into it.
    onMount?: () => void;
}

export function YooptaEditorWrapper({
    editor,
    plugins,
    tools,
    marks,
    value,
    selectionBoxRoot,
    autoFocus,
    onChange,
    className,
    style,
    readOnly,
    onMount,
}: YooptaEditorWrapperProps) {
    // YooptaEditor populates editor.plugins/blocks/formats in its render-phase
    // init, which completes before this child effect runs — so the maps are
    // guaranteed ready when onMount fires.
    useEffect(() => {
        onMount?.();
        // Run once on mount only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <YooptaEditor
            editor={editor}
            plugins={plugins}
            tools={tools}
            marks={marks}
            value={value}
            selectionBoxRoot={selectionBoxRoot}
            autoFocus={autoFocus}
            onChange={onChange}
            className={className}
            style={style}
            readOnly={readOnly}
        />
    );
}
