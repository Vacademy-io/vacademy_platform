import type { FC } from 'react';

/** globalSettings.courseFormats as stored: { [formatId]: { label, levels, … } }. */
type CourseFormats = Record<string, unknown>;

export interface CourseFormatsCardProps {
    /** globalSettings.courseFormats (the card is only mounted when it exists). */
    formats: CourseFormats;
    /** globalSettings.courseFormatOrder, when set. */
    order: string[] | undefined;
    /**
     * Writes the given globalSettings keys (courseFormats and/or
     * courseFormatOrder) in one edit; keys left out are not touched.
     */
    onChange: (next: { courseFormats?: CourseFormats; courseFormatOrder?: string[] }) => void;
}

/**
 * Course formats (labels, order, add/remove). PropertyPanel mounts it in
 * Global Settings only when globalSettings.courseFormats exists; filled in by
 * a later change.
 */
export const CourseFormatsCard: FC<CourseFormatsCardProps> = () => null;
