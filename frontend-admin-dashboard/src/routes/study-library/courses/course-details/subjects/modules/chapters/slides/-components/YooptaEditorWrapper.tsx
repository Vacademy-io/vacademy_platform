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
}: YooptaEditorWrapperProps) {
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
        />
    );
}
