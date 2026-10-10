import type { FC } from 'react';

/** Banner props are hand- or AI-written JSON: read them as unknown and narrow. */
type Props = Record<string, unknown>;

export interface CtaBandFieldsProps {
    /** The ctaBanner props. */
    props: Props;
    /** Writes one prop, keeping every other prop. */
    updateProp: (key: string, value: unknown) => void;
    /** Writes several props in one edit, keeping every other prop. */
    patchProps: (next: Props) => void;
}

/**
 * Fields of the "band" banner (eyebrow, second button, button styles, phone
 * mockup, band size). PropertyPanel mounts it for every ctaBanner; band-only
 * fields must render only when props.variant is 'band'. Filled in by a later
 * change.
 */
export const CtaBandFields: FC<CtaBandFieldsProps> = () => null;
