import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useVideoEditorStore } from './stores/video-editor-store';

/**
 * Shared collapsible disclosure for "advanced" controls (raw CSS, CSS class,
 * tag-name editor, custom transform / filter inputs, etc.).
 *
 * Behaviour:
 *   - simple viewMode (default): rendered collapsed; user clicks the header
 *     to expand. Power-users keep full access to every underlying input.
 *   - developer viewMode: pre-expanded so the same controls are visible
 *     without an extra click.
 *
 * Important: this component never *hides* its children unconditionally. The
 * collapsed state is purely a UX affordance — clicking "Advanced ▸" always
 * reveals the same controls. That's what keeps the editor non-frightening
 * for layman users while leaving them fully capable.
 */
export function AdvancedSection({
    children,
    label = 'Advanced',
}: {
    children: React.ReactNode;
    label?: string;
}) {
    const viewMode = useVideoEditorStore((s) => s.viewMode);
    const [open, setOpen] = useState(viewMode === 'developer');

    // When the user flips the global toggle, mirror that into local state so
    // entering developer mode immediately reveals every advanced section.
    // Leaving developer mode collapses them back; user can still click to
    // re-open any individual one.
    useEffect(() => {
        setOpen(viewMode === 'developer');
    }, [viewMode]);

    return (
        <div className="mt-2 border-t border-gray-200 pt-2">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600"
                aria-expanded={open}
            >
                {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                {label}
            </button>
            {open && <div className="mt-2 space-y-2">{children}</div>}
        </div>
    );
}
