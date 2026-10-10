import type { FC } from 'react';

/** Header props are hand- or AI-written JSON: read them as unknown and narrow. */
type Props = Record<string, unknown>;

export interface HeaderLookGroupProps {
    /** The header props. */
    props: Props;
    /** Writes one header prop, keeping every other prop. */
    onChange: (key: string, value: unknown) => void;
}

/**
 * The header's "Look" options (nav style, bar size, width, logo only,
 * language switch style, cart icon, mega-menu style). PropertyPanel mounts it
 * for every header, right after HeaderDisplayOptions; an unset option must
 * show the original look and nothing may be written until the admin changes
 * a control. Filled in by a later change.
 */
export const HeaderLookGroup: FC<HeaderLookGroupProps> = () => null;
