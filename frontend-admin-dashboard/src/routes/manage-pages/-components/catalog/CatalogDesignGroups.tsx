import type { FC } from 'react';
import type { CatalogueConfig } from '../../-types/editor-types';

/** Section props are hand- or AI-written JSON: read them as unknown and narrow. */
type Props = Record<string, unknown>;

export interface CatalogDesignGroupsProps {
    /** The courseCatalog section (in the language being edited). */
    component: { id: string; type?: string; props: Props };
    pageId: string;
    updateComponent: (pageId: string, componentId: string, patch: { props: Props }) => void;
    /** Shallow-merges `next` into the section props (every other prop is kept). */
    patch: (next: Props) => void;
    /** Merges `next` into the object at props[key] (e.g. 'hero'), keeping its other keys. */
    setNested: (key: string, next: Props) => void;
    /** The whole site being edited (read-only): globalSettings, pages. */
    catalogue: CatalogueConfig | null;
}

/**
 * Editors for the courses page's opt-in design (page header / hero, rows above
 * and below the grid, sidebar, card texts). Mounted by PropertyPanel under the
 * discovery settings of every courseCatalog section; filled in by a later
 * change. Each group must render only when its setting exists.
 */
export const CatalogDesignGroups: FC<CatalogDesignGroupsProps> = () => null;
