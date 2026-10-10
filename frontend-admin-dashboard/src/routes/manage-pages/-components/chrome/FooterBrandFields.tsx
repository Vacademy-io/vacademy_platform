import type { FC } from 'react';

/** Footer props are hand- or AI-written JSON: read them as unknown and narrow. */
type Props = Record<string, unknown>;

export interface FooterBrandFieldsProps {
    /** The footer props (variant is 'brand'). */
    props: Props;
    /** Writes one prop, keeping every other prop. */
    updateProp: (key: string, value: unknown) => void;
    /** Writes several props in one edit, keeping every other prop. */
    patchProps: (next: Props) => void;
}

/**
 * Extra fields of the "brand" footer (logo, taglines, newsletter, background,
 * language switch). PropertyPanel mounts it only when props.variant is
 * 'brand'; filled in by a later change.
 */
export const FooterBrandFields: FC<FooterBrandFieldsProps> = () => null;
