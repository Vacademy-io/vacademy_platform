import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Label } from '@/components/ui/label';
import { Bold, Italic, Heading2, Link as LinkIcon, List } from 'lucide-react';

interface RichTextFieldProps {
    label: string;
    value: string; // HTML string
    onChange: (html: string) => void;
    placeholder?: string;
}

/**
 * Lightweight rich text editor for the property panel.
 * Supports Bold, Italic, H2, Links, and unordered lists.
 * Stores and returns HTML strings (backward compatible with existing string props).
 */
export const RichTextField = ({ label, value, onChange, placeholder }: RichTextFieldProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] } }),
            Link.configure({ openOnClick: false }),
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            // Emit empty string for empty paragraphs to keep it clean
            onChange(html === '<p></p>' ? '' : html);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none min-h-[80px] p-2 focus:outline-none',
            },
        },
    });

    // Sync content when external value changes (e.g., undo/redo from store)
    useEffect(() => {
        if (!editor) return;
        const currentHtml = editor.getHTML();
        if (currentHtml !== value && value !== undefined) {
            editor.commands.setContent(value || '', false);
        }
    }, [value, editor]);

    if (!editor) return null;

    const ToolbarButton = ({
        active,
        onClick,
        children,
        title,
    }: {
        active?: boolean;
        onClick: () => void;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 ${active ? 'bg-gray-200 text-gray-900' : ''}`}
        >
            {children}
        </button>
    );

    const addLink = () => {
        const url = window.prompt('Enter URL');
        if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
    };

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="rounded border border-gray-200 bg-white">
                {/* Minimal toolbar */}
                <div className="flex items-center gap-0.5 border-b border-gray-200 px-1 py-1">
                    <ToolbarButton
                        active={editor.isActive('bold')}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Bold"
                    >
                        <Bold className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        active={editor.isActive('italic')}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Italic"
                    >
                        <Italic className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        active={editor.isActive('heading', { level: 2 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="Heading"
                    >
                        <Heading2 className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        active={editor.isActive('bulletList')}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Bullet list"
                    >
                        <List className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton
                        active={editor.isActive('link')}
                        onClick={addLink}
                        title="Add link"
                    >
                        <LinkIcon className="size-3.5" />
                    </ToolbarButton>
                </div>
                {/* Editor area */}
                <EditorContent editor={editor} />
                {!value && placeholder && (
                    <p className="pointer-events-none absolute p-2 text-sm text-gray-400">
                        {placeholder}
                    </p>
                )}
            </div>
        </div>
    );
};
