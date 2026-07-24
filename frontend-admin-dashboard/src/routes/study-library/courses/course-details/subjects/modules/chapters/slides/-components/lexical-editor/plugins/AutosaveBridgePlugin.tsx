import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { exportDocHtml } from '../serialization';

/**
 * Bridges Lexical edits to slide-material's unsaved-draft tracking.
 * Debounces 500ms (mirroring the Yoopta onChange) and reports the FULL
 * stored-format HTML (marker wrapper + formatHTMLString skeleton) so the
 * consumer can compare it 1:1 against the load-time baseline.
 */
export function AutosaveBridgePlugin({
    onDebouncedHtml,
}: {
    onDebouncedHtml: (html: string) => void;
}) {
    const [editor] = useLexicalComposerContext();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbackRef = useRef(onDebouncedHtml);
    callbackRef.current = onDebouncedHtml;

    useEffect(() => {
        const unregister = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
            // Skip selection-only updates
            if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                try {
                    callbackRef.current(exportDocHtml(editor));
                } catch (error) {
                    console.error('[Lexical] autosave serialize failed:', error);
                }
            }, 500);
        });
        return () => {
            // Clear the pending debounce on unmount (slide switch) so a stale
            // timer can't report this slide's HTML into the next slide's refs.
            if (timerRef.current) clearTimeout(timerRef.current);
            unregister();
        };
    }, [editor]);

    return null;
}
