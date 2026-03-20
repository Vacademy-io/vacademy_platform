import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Typography from '@tiptap/extension-typography';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Code, Monitor, Tablet, Smartphone, FileText } from 'lucide-react';
import './EmailRichTextEditor.css';

interface EmailRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: number | string;
  className?: string;
  onInsertVariable?: (variable: string) => void;
  subject?: string;
  onSourceViewChange?: (isSourceView: boolean) => void;
  showPreviewButton?: boolean;
  onPreview?: () => void;
}

// Device presets for preview
const DEVICE_PRESETS: Record<'mobile' | 'tablet' | 'laptop', { label: string; width: number }> = {
  mobile: { label: 'Mobile', width: 390 },
  tablet: { label: 'Tablet', width: 768 },
  laptop: { label: 'Laptop', width: 1024 },
};

// Toolbar button component
const ToolbarButton = ({
  title,
  onClick,
  isActive = false,
  children
}: {
  title: string;
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`rounded px-2 py-1 hover:bg-neutral-100 ${isActive ? 'bg-neutral-200' : ''}`}
    data-active={isActive}
  >
    {children}
  </button>
);

// Text formatting toolbar section
const TextFormattingToolbar = ({ editor }: { editor: Editor | null }) => (
  <div className="flex items-center gap-1">
    <ToolbarButton
      title="Bold"
      onClick={() => editor?.chain().focus().toggleBold().run()}
      isActive={editor?.isActive('bold')}
    >
      <strong>B</strong>
    </ToolbarButton>
    <ToolbarButton
      title="Italic"
      onClick={() => editor?.chain().focus().toggleItalic().run()}
      isActive={editor?.isActive('italic')}
    >
      <em>I</em>
    </ToolbarButton>
    <ToolbarButton
      title="Underline"
      onClick={() => editor?.chain().focus().toggleUnderline().run()}
      isActive={editor?.isActive('underline')}
    >
      <u>U</u>
    </ToolbarButton>
    <ToolbarButton
      title="Highlight"
      onClick={() => editor?.chain().focus().toggleHighlight().run()}
      isActive={editor?.isActive('highlight')}
    >
      HL
    </ToolbarButton>
  </div>
);

// List formatting toolbar section
const ListFormattingToolbar = ({ editor }: { editor: Editor | null }) => (
  <div className="flex items-center gap-1">
    <ToolbarButton
      title="Bullet List"
      onClick={() => editor?.chain().focus().toggleBulletList().run()}
      isActive={editor?.isActive('bulletList')}
    >
      •
    </ToolbarButton>
    <ToolbarButton
      title="Ordered List"
      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      isActive={editor?.isActive('orderedList')}
    >
      1.
    </ToolbarButton>
    <ToolbarButton
      title="Blockquote"
      onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      isActive={editor?.isActive('blockquote')}
    >
      &ldquo; &rdquo;
    </ToolbarButton>
  </div>
);

// Text alignment toolbar section
const TextAlignmentToolbar = ({ editor }: { editor: Editor | null }) => (
  <div className="flex items-center gap-1">
    <ToolbarButton
      title="Align Left"
      onClick={() => editor?.chain().focus().setTextAlign('left').run()}
    >
      L
    </ToolbarButton>
    <ToolbarButton
      title="Align Center"
      onClick={() => editor?.chain().focus().setTextAlign('center').run()}
    >
      C
    </ToolbarButton>
    <ToolbarButton
      title="Align Right"
      onClick={() => editor?.chain().focus().setTextAlign('right').run()}
    >
      R
    </ToolbarButton>
  </div>
);

// Preview modal component
const PreviewModal = ({
  isOpen,
  onClose,
  value,
  subject,
  previewDevice,
  setPreviewDevice,
  previewWidth
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  subject: string;
  previewDevice: 'mobile' | 'tablet' | 'laptop';
  setPreviewDevice: (device: 'mobile' | 'tablet' | 'laptop') => void;
  previewWidth: number;
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Email Preview</DialogTitle>
      </DialogHeader>
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Device:</span>
          <select
            value={previewDevice}
            onChange={(e) => setPreviewDevice(e.target.value as 'mobile' | 'tablet' | 'laptop')}
            className="px-3 py-1 border rounded-md text-sm"
          >
            {Object.entries(DEVICE_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex justify-center overflow-auto">
          <div
            className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
            style={{ width: previewWidth }}
          >
            <div className="border-b bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {DEVICE_PRESETS[previewDevice].label} Preview
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {previewWidth}px
                </div>
              </div>
            </div>
            <div className="p-6 min-h-[200px]">
              {subject && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600 mb-1">Subject:</div>
                  <div className="text-lg font-semibold text-gray-900">{subject}</div>
                </div>
              )}
              {value ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: value }}
                />
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                  No content to preview
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export function EmailRichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Enter email body content...',
  minHeight = 200,
  className = '',
  onInsertVariable,
  subject = '',
  onSourceViewChange,
  showPreviewButton = true,
  onPreview,
}: EmailRichTextEditorProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [contentView, setContentView] = useState<'editor' | 'source'>('editor');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Notify parent when source view changes
  useEffect(() => {
    onSourceViewChange?.(contentView === 'source');
  }, [contentView, onSourceViewChange]);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'laptop'>('laptop');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [previewWidth, setPreviewWidth] = useState(1024);

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update preview width when device or window width changes
  useEffect(() => {
    const deviceWidth = DEVICE_PRESETS[previewDevice].width;
    const availableWidth = windowWidth - 120; // Account for padding and margins
    setPreviewWidth(Math.min(deviceWidth, availableWidth));
  }, [previewDevice, windowWidth]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Highlight,
      TextStyle,
      Color,
      Typography,
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
          class: 'text-blue-600 underline font-medium hover:text-blue-700',
          style: 'color:#2563eb;text-decoration:underline;font-weight:500;',
        },
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      try {
        const html = editor.getHTML();
        onChange(html);
      } catch (error) {
        console.warn('Error getting HTML from editor:', error);
        // Fallback to the raw content if there's an error
        onChange(value || '');
      }
    },
    editorProps: {
      attributes: {
        style: `min-height: ${typeof minHeight === 'number' ? `${minHeight}px` : minHeight}; outline: none;`,
        class: `prose prose-neutral prose-sm max-w-none focus:outline-none ${className}`,
      },
    },
  });

  // Sync external value changes into TipTap
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      try {
        // Simply set the content as-is, TipTap should handle template variables fine
        editor.commands.setContent(value || '', false);
      } catch (error) {
        console.warn('Error setting content in TipTap editor:', error);
        // If there's an error setting content, try to set it as plain text
        try {
          const escapedContent = (value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          editor.commands.setContent(`<p>${escapedContent}</p>`, false);
        } catch (fallbackError) {
          console.warn('Fallback content setting also failed:', fallbackError);
        }
      }
    }
  }, [value, editor]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const currentAttrs = editor.getAttributes('link') as { href?: string };
    const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to) || '';
    setLinkUrl(currentAttrs?.href || '');
    setLinkText(sel);
    setShowLinkModal(true);
  }, [editor]);

  const insertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          if (src && editor) {
            editor.chain().focus().setImage({ src, alt: file.name }).run();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [editor]);

  const canUndo = !!editor?.can().undo();
  const canRedo = !!editor?.can().redo();

  return (
    <div className={`rounded-md border bg-white shadow-sm ${className || ''}`.trim()}>
      {/* View Toggle Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b p-3 gap-3">
        <div className="toggle-button-group flex items-center gap-1 p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContentView('editor');
            }}
            className={`flex items-center gap-2 transition-all duration-200 rounded-md ${
              contentView === 'editor'
                ? 'toggle-button-active'
                : 'toggle-button-inactive'
            }`}
          >
            <FileText className="size-4" />
            Rich Editor
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContentView('source');
            }}
            className={`flex items-center gap-2 transition-all duration-200 rounded-md ${
              contentView === 'source'
                ? 'toggle-button-active'
                : 'toggle-button-inactive'
            }`}
          >
            <Code className="size-4" />
            HTML Source
          </Button>
        </div>
        {showPreviewButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onPreview) {
                onPreview();
              } else {
                setIsPreviewOpen(true);
              }
            }}
            disabled={isPreviewOpen}
            className="flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Eye className="size-4" />
            Preview
          </Button>
        )}
      </div>

      {/* Editor Content */}
      {contentView === 'editor' && (
        <>
          {/* Toolbar */}
          <div className="tiptap-toolbar flex flex-wrap items-center gap-1 overflow-x-auto border-b p-2 text-sm">
            <TextFormattingToolbar editor={editor} />
        <div className="mx-1 h-6 w-px bg-neutral-200" />
            <ListFormattingToolbar editor={editor} />
        <div className="mx-1 h-6 w-px bg-neutral-200" />
            <TextAlignmentToolbar editor={editor} />

        <div className="mx-1 h-6 w-px bg-neutral-200" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Insert Link"
            onClick={insertLink}
            className="rounded px-2 py-1 hover:bg-neutral-100"
          >
            🔗
          </button>
          <button
            type="button"
            title="Insert Image"
            onClick={insertImage}
            className="rounded px-2 py-1 hover:bg-neutral-100"
          >
            🖼️
          </button>
        </div>

        <div className="mx-1 h-6 w-px bg-neutral-200" />

        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">Color</span>
          <input
            type="color"
            onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
            className="h-6 w-6 cursor-pointer rounded border p-0"
          />
        </div>

        <span className="ml-auto flex gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
            className="rounded px-2 py-1 hover:bg-neutral-100 disabled:opacity-50"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
            className="rounded px-2 py-1 hover:bg-neutral-100 disabled:opacity-50"
          >
            Redo
          </button>
        </span>
      </div>

          {/* Editor Content */}
          <div className="p-2" style={{ maxHeight: 'inherit', minHeight: 'inherit', overflowY: 'auto' }}>
            <EditorContent
              editor={editor}
              onBlur={onBlur}
              className="tiptap-content"
              style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight, maxHeight: 'inherit' }}
            />
          </div>
        </>
      )}

      {/* Source View */}
      {contentView === 'source' && (
        <div className="p-2">
          <Textarea
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className="min-h-[200px] font-mono text-sm"
            placeholder="Edit raw HTML source..."
          />
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/20">
          <div className="w-full max-w-md rounded-md border bg-white p-4 shadow-lg">
            <div className="mb-3 text-sm font-medium">Insert Link</div>
            <div className="mb-2">
              <label className="mb-1 block text-xs text-neutral-600">URL</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-neutral-600">Text</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Link text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded px-3 py-1 text-sm hover:bg-neutral-100"
                onClick={() => setShowLinkModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-neutral-100 px-3 py-1 text-sm hover:bg-neutral-200"
                onClick={() => {
                  if (!editor || !linkUrl) { setShowLinkModal(false); return; }
                  const { from, to } = editor.state.selection;
                  if (from === to) {
                    const text = linkText?.trim() || linkUrl;
                    editor
                      .chain()
                      .focus()
                      .insertContent(text)
                      .setTextSelection({ from, to: from + text.length })
                      .setLink({ href: linkUrl })
                      .setTextSelection({ from: from + text.length, to: from + text.length })
                      .run();
                  } else {
                    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
                  }
                  setShowLinkModal(false);
                }}
              >
                Apply
              </button>
              <button
                className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                onClick={() => {
                  editor?.chain().focus().unsetLink().run();
                  setShowLinkModal(false);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        value={value}
        subject={subject}
        previewDevice={previewDevice}
        setPreviewDevice={setPreviewDevice}
        previewWidth={previewWidth}
      />
    </div>
  );
}

export default EmailRichTextEditor;
