import type { PageResponse } from '../-types/mentorship-types';

/**
 * Spring `Page` responses mix two naming conventions in one payload: the envelope
 * is named from Page's getters (`totalElements`, `totalPages`) because the app sets
 * no global naming strategy, while the DTOs inside `content` carry their own
 * `@JsonNaming(SnakeCase)`. Reading `total_elements` off the envelope therefore
 * yields undefined — which rendered a populated mentor list as "No mentors yet",
 * since the empty check was `(total_elements ?? 0) === 0`.
 *
 * This normalizes either spelling into the snake_case shape the components expect,
 * so the screens keep working whichever way the backend serializes a page.
 */
interface RawSpringPage<T> {
    content?: T[];
    totalPages?: number;
    totalElements?: number;
    total_pages?: number;
    total_elements?: number;
    number?: number;
    size?: number;
    first?: boolean;
    last?: boolean;
}

export function normalizePage<T>(raw: unknown): PageResponse<T> {
    const page = (raw ?? {}) as RawSpringPage<T>;
    const content = Array.isArray(page.content) ? page.content : [];
    // Fall back to the content length so a page always reports at least what it
    // actually carries, even if both spellings are missing.
    const totalElements = page.total_elements ?? page.totalElements ?? content.length;
    const totalPages = page.total_pages ?? page.totalPages ?? (content.length > 0 ? 1 : 0);

    return {
        content,
        total_elements: totalElements,
        total_pages: totalPages,
        number: page.number ?? 0,
        size: page.size ?? content.length,
        first: page.first,
        last: page.last,
    };
}
