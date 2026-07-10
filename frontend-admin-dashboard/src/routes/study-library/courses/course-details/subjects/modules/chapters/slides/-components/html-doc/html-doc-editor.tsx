import { useMemo, useRef } from 'react';
import { TipTapEditor } from '@/components/tiptap/TipTapEditor';
import { Slide } from '../../-hooks/use-slides';
import { getInitialHtmlDocContent, normalizeCodeBlocksHtml } from './html-doc-utils';

type HtmlDocEditorProps = {
    slide: Slide;
    isLearnerView?: boolean;
    /**
     * Fires with the normalized (data-code re-encoded) HTML on every edit.
     * The parent stashes it in a ref for Save Draft / Publish and schedules
     * the debounced autosave.
     */
    onHtmlChange: (slideId: string, html: string) => void;
};

/**
 * Editor surface for the HTML document slide type (document_slide.type='HTML').
 *
 * A deliberate contrast to the Yoopta 'DOC' path: content is a plain HTML
 * string end-to-end (stored HTML → Tiptap → HTML out), so there is no lossy
 * deserialize/serialize round-trip, no manual plugin-map bootstrapping and no
 * degraded-save machinery. The parent (slide-material) owns persistence.
 */
export function HtmlDocEditor({ slide, isLearnerView = false, onHtmlChange }: HtmlDocEditorProps) {
    // Initial content is computed once per mount; slide-material remounts this
    // component per slide via key={slide.id}, matching the other slide types.
    const initialContent = useMemo(() => getInitialHtmlDocContent(slide), [slide.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const slideIdRef = useRef(slide.id);
    slideIdRef.current = slide.id;

    return (
        <div className="mx-auto w-full max-w-4xl px-4 pb-16">
            <TipTapEditor
                value={initialContent}
                editable={!isLearnerView}
                hideToolbar={isLearnerView}
                minHeight={400}
                placeholder="Click to start writing here..."
                onChange={(htmlString) => {
                    if (isLearnerView) return;
                    onHtmlChange(slideIdRef.current, normalizeCodeBlocksHtml(htmlString));
                }}
                className="html-doc-slide-editor"
            />
        </div>
    );
}
