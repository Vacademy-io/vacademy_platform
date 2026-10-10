import type { FC } from 'react';

/** Hero props are hand- or AI-written JSON: read them as unknown and narrow. */
type Props = Record<string, unknown>;

export interface HeroEditorialFieldsProps {
    /** The heroSection props. */
    props: Props;
    /** Writes one prop, keeping every other prop. */
    updateProp: (key: string, value: unknown) => void;
    /** Writes several props in one edit, keeping every other prop. */
    patchProps: (next: Props) => void;
    /** Writes one field of props.left (title, titleAccent, checklist…), keeping the rest of it. */
    updateLeft: (field: string, value: unknown) => void;
}

/**
 * Fields of the "editorial" hero (accent line, checklist, breadcrumb, media
 * width, outline colour). PropertyPanel mounts it for every heroSection;
 * editorial-only fields must render only when props.variant is 'editorial'.
 * Filled in by a later change.
 */
export const HeroEditorialFields: FC<HeroEditorialFieldsProps> = () => null;
