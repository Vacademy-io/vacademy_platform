import { Elements, type YooEditor } from '@yoopta/editor';

/**
 * Run `mutate`, then undo the spurious scroll it causes WHILE THE USER IS
 * TYPING in a nested field.
 *
 * Why: step 2 below (`set_block_value`) re-renders the WHOLE document editor,
 * which makes Slate re-run "scroll selection into view" against the main
 * selection — and that selection sits on the (tall) custom void block being
 * edited. On every keystroke the viewport therefore jumps up to the block's
 * top. We can't skip the sync (the serializer reads editor.children, so it
 * must stay fresh per keystroke or Save/auto-save loses edits), so instead we
 * pin the scroll offsets of the caret's scrollable ancestors and restore them.
 *
 * Two guards keep this from FIGHTING the user's own scrolling:
 *  - Only run when an editable element is focused (real typing). A commit fired
 *    on blur, from an effect, or while the user is scrolling the page must not
 *    pin scroll — otherwise the page becomes unscrollable near a tall block.
 *  - Restore only synchronously and on the microtask queue — both finish before
 *    the browser paints, so the jump is cancelled without lingering into the
 *    next animation frame (where a wheel/trackpad scroll would land and get
 *    snapped back).
 */
function preserveScroll(mutate: () => void): void {
    const active =
        typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    const isEditing =
        !!active &&
        (active.isContentEditable ||
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA');
    if (typeof window === 'undefined' || !isEditing) {
        mutate();
        return;
    }

    type Saved = { el: HTMLElement; top: number; left: number };
    const saved: Saved[] = [];
    let node: HTMLElement | null = active;
    while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
            saved.push({ el: node, top: node.scrollTop, left: node.scrollLeft });
        }
        node = node.parentElement;
    }
    const winTop = window.scrollY;
    const winLeft = window.scrollX;

    mutate();

    const restore = () => {
        for (const s of saved) {
            if (s.el.scrollTop !== s.top) s.el.scrollTop = s.top;
            if (s.el.scrollLeft !== s.left) s.el.scrollLeft = s.left;
        }
        if (window.scrollY !== winTop || window.scrollX !== winLeft) {
            window.scrollTo(winLeft, winTop);
        }
    };

    restore();
    queueMicrotask(restore);
}

/**
 * Persist a custom block's props to Yoopta atomically.
 *
 * Why this exists: Yoopta's `Elements.updateElement` only writes to the
 * block's internal Slate tree (blockEditorsMap[blockId].children). It does
 * NOT sync back to editor.children[blockId].value — which is what
 * html.serialize / getHTML actually reads. So custom blocks (quiz, tabs,
 * flashcards, etc.) that hold their payload in props.* render correctly
 * from Slate but serialize stale/empty props, making Save Draft ship
 * blank blocks.
 *
 * The naive fix — set_block_value with forceSlate: true — replaces
 * slate.children with a brand-new array reference, which causes Slate's
 * React renderer to unmount and remount the block on every keystroke
 * (useState re-initializes, textareas lose focus, `isEditing` resets to
 * preview mode). So instead we:
 *   1. Elements.updateElement → mutates the element's props via
 *      Transforms.setNodes, preserving element identity (no remount).
 *   2. set_block_value WITHOUT forceSlate → syncs block.value so the
 *      serializer reads the fresh props.
 *
 * Both run in the same tick, React re-renders once, focus is preserved.
 * Step 2 is wrapped in preserveScroll() so the main-editor re-render it
 * triggers doesn't scroll the caret's viewport up to the block's top.
 */
export function commitBlockProps(
    editor: YooEditor,
    blockId: string,
    element: any,
    nextProps: Record<string, unknown>
): void {
    // 1. Mutate Slate tree in-place (preserves element identity).
    Elements.updateElement(editor, blockId, {
        type: element.type,
        props: {
            ...element.props,
            ...nextProps,
        },
    });

    // 2. Sync block.value so html.serialize reads the fresh props.
    // We rebuild the element from the caller's view of props rather
    // than re-reading Slate — Elements.updateElement schedules its work
    // via applyTransforms, so Slate may not have flushed by the time
    // the next transform runs.
    const nextElement = {
        ...element,
        props: {
            ...element.props,
            ...nextProps,
        },
    };
    preserveScroll(() => {
        (editor as any).applyTransforms(
            [
                {
                    type: 'set_block_value',
                    id: blockId,
                    value: [nextElement],
                    // No forceSlate — Elements.updateElement already handled
                    // the Slate side above with proper identity preservation.
                },
            ],
            { validatePaths: false }
        );
    });
}
