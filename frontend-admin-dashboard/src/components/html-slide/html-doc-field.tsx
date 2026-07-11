import { useState } from 'react';
import { Code, Eye } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { HtmlSlidePreview } from './html-slide-preview';

type HtmlDocFieldProps = {
    /** HTML string. */
    value: string;
    /** Called with edited HTML (source edits). */
    onChange?: (html: string) => void;
    /** Read-only preview when false. Default true. */
    editable?: boolean;
    /** Pixel height of the preview/source area. Default 420. */
    minHeight?: number;
    /** Placeholder for the raw-HTML source editor. */
    placeholder?: string;
    className?: string;
};

/**
 * Drop-in replacement for the old rich-text editor in the AI-copilot flow.
 * HTML document content is now creative, self-contained HTML, so it must render
 * in a sandboxed iframe (a block editor would mangle the `<style>`/`<script>`
 * and animations). Editing is via raw HTML source — AI is the primary author.
 */
export function HtmlDocField({
    value,
    onChange,
    editable = true,
    minHeight = 420,
    placeholder,
    className,
}: HtmlDocFieldProps) {
    const [showSource, setShowSource] = useState(false);

    return (
        <div className={cn('overflow-hidden rounded-md border border-neutral-200', className)}>
            {editable && (
                <div className="flex items-center justify-end border-b border-neutral-100 bg-neutral-50 px-2 py-1.5">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setShowSource((s) => !s)}
                    >
                        {showSource ? <Eye className="size-4" /> : <Code className="size-4" />}
                        {showSource ? 'Preview' : 'Edit HTML'}
                    </MyButton>
                </div>
            )}
            {editable && showSource ? (
                <Textarea
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    spellCheck={false}
                    placeholder={placeholder}
                    className="resize-y whitespace-pre border-0 font-mono text-caption focus-visible:ring-0"
                    // Dynamic author-chosen height for the source editor.
                    style={{ minHeight }}
                />
            ) : (
                // Dynamic height container; the iframe scrolls internally.
                <div style={{ height: minHeight }}>
                    <HtmlSlidePreview html={value} autoResize={false} />
                </div>
            )}
        </div>
    );
}
