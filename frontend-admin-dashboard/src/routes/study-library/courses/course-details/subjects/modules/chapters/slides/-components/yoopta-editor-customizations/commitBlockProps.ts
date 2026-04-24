import { Elements, type YooEditor } from '@yoopta/editor';

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
}
