/**
 * Side-channel for raw scene HTML strings, keyed by `shot_index`. Lifted
 * out of `SceneSlot` deliberately — the raw HTML is ~50KB×N, doesn't belong
 * in the derived domain state, and is only needed at the leaves
 * (SceneNode, SceneDetail). PipelineFlow provides this map from
 * `useSceneThumbnails`; consumers read by index.
 */
import { createContext, useContext } from 'react';

export const ScenesHtmlContext = createContext<Record<number, string | undefined>>({});

export function useSceneHtml(index: number): string | undefined {
    return useContext(ScenesHtmlContext)[index];
}
